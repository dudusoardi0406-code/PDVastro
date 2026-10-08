-- PDVastro: funções atômicas (chamadas só pelo servidor, com a chave secreta)

-- Dia operacional: vira às 06:00 de Porto Velho (eventos vão das 20h às 04h)
create or replace function public.business_date_at(ts timestamptz default now())
returns date
language sql
stable
set search_path = public
as $$
  select ((ts at time zone 'America/Porto_Velho') - interval '6 hours')::date;
$$;

-- ---------------------------------------------------------------------------
-- Cria o pedido recalculando tudo pelo banco. O totem só manda IDs e quantidades.
-- p_items: [{"product_id": "...", "quantity": 2}, ...]
-- ---------------------------------------------------------------------------
create or replace function public.create_order(p_totem_id uuid, p_items jsonb)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_event public.events%rowtype;
  v_order_id uuid;
  v_requested int;
  v_found int;
  v_max_qty int;
  v_total bigint;
begin
  select e.* into v_event
  from public.totems t
  join public.events e on e.id = t.event_id
  where t.id = p_totem_id;

  if not found then
    raise exception 'TOTEM_SEM_EVENTO';
  end if;
  if not v_event.active then
    raise exception 'EVENTO_INATIVO';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'CARRINHO_VAZIO';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'CARRINHO_GRANDE';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) e
    where coalesce(e->>'quantity', '') !~ '^[0-9]{1,2}$' or (e->>'quantity')::int < 1
  ) then
    raise exception 'QUANTIDADE_INVALIDA';
  end if;

  select count(*), count(p.id), coalesce(max(r.quantity), 0), coalesce(sum(p.price_cents::bigint * r.quantity), 0)
    into v_requested, v_found, v_max_qty, v_total
  from (
    select (e->>'product_id')::uuid as product_id, sum((e->>'quantity')::int)::int as quantity
    from jsonb_array_elements(p_items) e
    group by 1
  ) r
  left join (public.products p join public.categories c on c.id = p.category_id and c.active)
    on p.id = r.product_id and p.event_id = v_event.id and p.active;

  if v_found <> v_requested then
    raise exception 'PRODUTO_INDISPONIVEL';
  end if;
  if v_max_qty > 99 then
    raise exception 'QUANTIDADE_INVALIDA';
  end if;
  if v_total <= 0 or v_total > 10000000 then
    raise exception 'TOTAL_INVALIDO';
  end if;

  insert into public.orders (event_id, totem_id, business_date, total_cents)
  values (v_event.id, p_totem_id, public.business_date_at(now()), v_total)
  returning id into v_order_id;

  insert into public.order_items (order_id, product_id, name_snapshot, unit_price_cents, quantity)
  select v_order_id, p.id, p.name, p.price_cents, r.quantity
  from (
    select (e->>'product_id')::uuid as product_id, sum((e->>'quantity')::int)::int as quantity
    from jsonb_array_elements(p_items) e
    group by 1
  ) r
  join public.products p on p.id = r.product_id;

  return jsonb_build_object('order_id', v_order_id, 'total_cents', v_total);
end;
$$;

-- ---------------------------------------------------------------------------
-- Abre uma cobrança para o pedido (primeira tentativa ou "tentar de novo").
-- O registro do pagamento nasce antes da chamada ao provedor; se o provedor
-- falhar, o servidor apaga o registro (discard_payment).
-- ---------------------------------------------------------------------------
create or replace function public.start_payment(p_order_id uuid, p_totem_id uuid, p_provider text, p_txid text)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_secs int;
  v_event_name text;
  v_payment_id uuid;
  v_expires timestamptz;
begin
  select * into v_order from public.orders
  where id = p_order_id and totem_id = p_totem_id
  for update;

  if not found then
    raise exception 'PEDIDO_NAO_ENCONTRADO';
  end if;
  if v_order.status not in ('aguardando_pagamento', 'expirado') then
    raise exception 'PEDIDO_NAO_PAGAVEL';
  end if;
  if exists (
    select 1 from public.payments
    where order_id = p_order_id and status = 'pendente' and expires_at > now()
  ) then
    raise exception 'PIX_JA_ATIVO';
  end if;

  -- pendentes vencidos viram expirados (se forem pagos depois, confirm_payment ainda aceita)
  update public.payments set status = 'expirado'
  where order_id = p_order_id and status = 'pendente';

  select pix_expiration_seconds, name into v_secs, v_event_name from public.events where id = v_order.event_id;
  v_expires := now() + make_interval(secs => v_secs);

  insert into public.payments (order_id, provider, txid, amount_cents, expires_at)
  values (p_order_id, p_provider, p_txid, v_order.total_cents, v_expires)
  returning id into v_payment_id;

  update public.orders set status = 'aguardando_pagamento' where id = p_order_id;

  return jsonb_build_object(
    'payment_id', v_payment_id,
    'amount_cents', v_order.total_cents,
    'expires_at', v_expires,
    'expiration_seconds', v_secs,
    'event_name', v_event_name
  );
end;
$$;

create or replace function public.discard_payment(p_payment_id uuid)
returns void
language sql
set search_path = public
as $$
  delete from public.payments where id = p_payment_id and status = 'pendente' and pix_copia_cola is null;
$$;

-- Trava simples para não consultar o provedor várias vezes ao mesmo tempo
create or replace function public.try_lock_payment_check(p_payment_id uuid, p_min_interval_ms int)
returns boolean
language sql
set search_path = public
as $$
  with u as (
    update public.payments set last_checked_at = now()
    where id = p_payment_id
      and (last_checked_at is null
           or last_checked_at < now() - make_interval(secs => p_min_interval_ms / 1000.0))
    returning 1
  )
  select exists (select 1 from u);
$$;

-- ---------------------------------------------------------------------------
-- Confirma um Pix (idempotente). Só deve ser chamada depois de o servidor
-- consultar o provedor; nunca com dados vindos só do webhook.
-- Retorna {"result": "pago" | "ja_processado" | "divergente" | "duplicado" | "nao_encontrado", ...}
-- ---------------------------------------------------------------------------
create or replace function public.confirm_payment(p_txid text, p_paid_cents int, p_e2e_id text, p_raw jsonb)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_pay public.payments%rowtype;
  v_order public.orders%rowtype;
  v_prefix text;
  v_num int;
  v_code text;
begin
  select * into v_pay from public.payments where txid = p_txid for update;
  if not found then
    return jsonb_build_object('result', 'nao_encontrado');
  end if;

  if v_pay.status in ('pago', 'divergente', 'duplicado') then
    return jsonb_build_object(
      'result', 'ja_processado',
      'order_id', v_pay.order_id,
      'ticket_code', (select o.ticket_code from public.orders o where o.id = v_pay.order_id)
    );
  end if;

  select * into v_order from public.orders where id = v_pay.order_id for update;

  -- valor pago precisa bater com a cobrança e com o pedido
  if p_paid_cents is distinct from v_pay.amount_cents or p_paid_cents is distinct from v_order.total_cents then
    update public.payments
    set status = 'divergente', paid_amount_cents = p_paid_cents, e2e_id = p_e2e_id,
        paid_at = now(), raw_provider = p_raw
    where id = v_pay.id;
    return jsonb_build_object('result', 'divergente', 'order_id', v_order.id);
  end if;

  -- pedido já pago por outra cobrança: registrar para estorno manual
  if v_order.status = 'pago' then
    update public.payments
    set status = 'duplicado', paid_amount_cents = p_paid_cents, e2e_id = p_e2e_id,
        paid_at = now(), raw_provider = p_raw
    where id = v_pay.id;
    return jsonb_build_object('result', 'duplicado', 'order_id', v_order.id, 'ticket_code', v_order.ticket_code);
  end if;

  select ticket_prefix into v_prefix from public.events where id = v_order.event_id;

  insert into public.ticket_counters (event_id, business_date, last_number)
  values (v_order.event_id, v_order.business_date, 1)
  on conflict (event_id, business_date)
    do update set last_number = public.ticket_counters.last_number + 1
  returning last_number into v_num;

  v_code := v_prefix || '-' || case when v_num < 1000 then lpad(v_num::text, 3, '0') else v_num::text end;

  -- mesmo que o pedido esteja expirado/cancelado: Pix pago nunca é perdido
  update public.orders
  set status = 'pago', paid_at = now(), ticket_number = v_num, ticket_code = v_code
  where id = v_order.id;

  update public.payments
  set status = 'pago', paid_amount_cents = p_paid_cents, e2e_id = p_e2e_id,
      paid_at = now(), raw_provider = p_raw
  where id = v_pay.id;

  insert into public.print_jobs (order_id, totem_id, kind)
  values (v_order.id, v_order.totem_id, 'original')
  on conflict (order_id) where kind = 'original' do nothing;

  return jsonb_build_object('result', 'pago', 'order_id', v_order.id, 'ticket_code', v_code);
end;
$$;

-- Expira (ou marca como removida) uma cobrança pendente
create or replace function public.expire_payment(p_txid text)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_order_id uuid;
begin
  update public.payments set status = 'expirado'
  where txid = p_txid and status = 'pendente'
  returning order_id into v_order_id;

  if v_order_id is not null then
    update public.orders set status = 'expirado'
    where id = v_order_id
      and status = 'aguardando_pagamento'
      and not exists (select 1 from public.payments where order_id = v_order_id and status = 'pendente');
  end if;
end;
$$;

-- Cliente cancelou no totem. Retorna os txids que devem ser removidos no provedor.
create or replace function public.cancel_order(p_order_id uuid, p_totem_id uuid)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_txids jsonb;
begin
  update public.orders set status = 'cancelado'
  where id = p_order_id and totem_id = p_totem_id and status in ('aguardando_pagamento', 'expirado');

  if not found then
    return jsonb_build_object('cancelled', false, 'txids', '[]'::jsonb);
  end if;

  with c as (
    update public.payments set status = 'cancelado'
    where order_id = p_order_id and status = 'pendente'
    returning txid
  )
  select coalesce(jsonb_agg(txid), '[]'::jsonb) into v_txids from c;

  return jsonb_build_object('cancelled', true, 'txids', v_txids);
end;
$$;

-- O totem só imprime se conseguir "pegar" o trabalho (evita ficha duplicada)
create or replace function public.claim_print_job(p_job_id uuid, p_totem_id uuid)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_order_id uuid;
begin
  update public.print_jobs set status = 'impresso', printed_at = now()
  where id = p_job_id and totem_id = p_totem_id and status = 'pendente'
  returning order_id into v_order_id;

  if v_order_id is null then
    return false;
  end if;

  update public.orders
  set printed_at = coalesce(printed_at, now()), print_count = print_count + 1
  where id = v_order_id;

  return true;
end;
$$;

-- Cobranças que o cron deve conferir no provedor
create or replace function public.payments_to_reconcile()
returns setof public.payments
language sql
stable
set search_path = public
as $$
  select * from public.payments
  where (status = 'pendente' and created_at > now() - interval '2 hours')
     or (status in ('expirado', 'cancelado') and created_at > now() - interval '20 minutes')
  order by created_at
  limit 100;
$$;

-- Pedidos que ficaram sem cobrança (provedor falhou e ninguém tentou de novo)
create or replace function public.close_stale_orders()
returns int
language plpgsql
set search_path = public
as $$
declare
  v_count int;
begin
  update public.orders o set status = 'cancelado'
  where o.status = 'aguardando_pagamento'
    and o.created_at < now() - interval '15 minutes'
    and not exists (select 1 from public.payments p where p.order_id = o.id and p.status = 'pendente');
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Copia categorias e produtos de um evento para outro
create or replace function public.copy_menu(p_from uuid, p_to uuid)
returns int
language plpgsql
set search_path = public
as $$
declare
  r record;
  v_new uuid;
  v_rows int;
  v_count int := 0;
begin
  if p_from = p_to then
    raise exception 'MESMO_EVENTO';
  end if;

  for r in select * from public.categories where event_id = p_from order by position, created_at loop
    insert into public.categories (event_id, name, position, active)
    values (p_to, r.name, r.position, r.active)
    returning id into v_new;

    insert into public.products (event_id, category_id, name, description, price_cents, image_url, position, active)
    select p_to, v_new, p.name, p.description, p.price_cents, p.image_url, p.position, p.active
    from public.products p
    where p.category_id = r.id;

    get diagnostics v_rows = row_count;
    v_count := v_count + v_rows;
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Relatório do dia operacional
-- ---------------------------------------------------------------------------
create or replace function public.sales_report(p_event_id uuid, p_date date)
returns jsonb
language sql
stable
set search_path = public
as $$
  with o as (
    select * from public.orders where event_id = p_event_id and business_date = p_date
  ),
  paid as (
    select * from o where status = 'pago'
  ),
  items as (
    select oi.* from public.order_items oi join paid on paid.id = oi.order_id
  ),
  pay as (
    select p.* from public.payments p join o on o.id = p.order_id
  )
  select jsonb_build_object(
    'total_cents', coalesce((select sum(total_cents) from paid), 0),
    'orders_paid', (select count(*) from paid),
    'orders_expired', (select count(*) from o where status = 'expirado'),
    'orders_cancelled', (select count(*) from o where status = 'cancelado'),
    'orders_pending', (select count(*) from o where status = 'aguardando_pagamento'),
    'items_sold', coalesce((select sum(quantity) from items), 0),
    'not_printed', (select count(*) from paid where printed_at is null),
    'by_product', coalesce((
      select jsonb_agg(x order by x.total_cents desc)
      from (
        select name_snapshot as name, sum(quantity)::int as quantity,
               sum(quantity * unit_price_cents)::bigint as total_cents
        from items group by name_snapshot
      ) x
    ), '[]'::jsonb),
    'by_hour', coalesce((
      select jsonb_agg(h order by h.first_at)
      from (
        select extract(hour from paid_at at time zone 'America/Porto_Velho')::int as hour,
               count(*)::int as orders, sum(total_cents)::bigint as total_cents, min(paid_at) as first_at
        from paid group by 1
      ) h
    ), '[]'::jsonb),
    'pix_received_cents', coalesce((select sum(paid_amount_cents) from pay where status = 'pago'), 0),
    'pix_received_count', (select count(*) from pay where status = 'pago'),
    'pix_problems', coalesce((
      select jsonb_agg(jsonb_build_object(
        'payment_id', pay.id, 'order_id', pay.order_id, 'status', pay.status, 'txid', pay.txid,
        'amount_cents', pay.amount_cents, 'paid_amount_cents', pay.paid_amount_cents,
        'e2e_id', pay.e2e_id, 'paid_at', pay.paid_at
      ) order by pay.paid_at)
      from pay where status in ('divergente', 'duplicado')
    ), '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------------
-- Permissões: nada é acessível por anon/authenticated; só a chave secreta.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;
