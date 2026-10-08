-- PDVastro: promoções do dia e destaques no cardápio
-- Rodar depois de 0002_functions.sql. Pode rodar mais de uma vez.

-- Categoria em destaque (ex.: "Promoções do dia") e subtítulo (ex.: "Até as 22h")
alter table public.categories add column if not exists featured boolean not null default false;
alter table public.categories add column if not exists subtitle text;
alter table public.categories drop constraint if exists categories_subtitle_len;
alter table public.categories add constraint categories_subtitle_len
  check (subtitle is null or length(subtitle) <= 80);

-- Preço "de" (riscado no totem). O preço cobrado continua sendo price_cents.
alter table public.products add column if not exists compare_at_cents int;
alter table public.products drop constraint if exists products_compare_at_gt_price;
alter table public.products add constraint products_compare_at_gt_price
  check (compare_at_cents is null or compare_at_cents > price_cents);

-- copy_menu passa a copiar os campos novos
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
    insert into public.categories (event_id, name, position, active, featured, subtitle)
    values (p_to, r.name, r.position, r.active, r.featured, r.subtitle)
    returning id into v_new;

    insert into public.products (event_id, category_id, name, description, price_cents, compare_at_cents, image_url, position, active)
    select p_to, v_new, p.name, p.description, p.price_cents, p.compare_at_cents, p.image_url, p.position, p.active
    from public.products p
    where p.category_id = r.id;

    get diagnostics v_rows = row_count;
    v_count := v_count + v_rows;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.copy_menu(uuid, uuid) from public, anon, authenticated;
grant execute on function public.copy_menu(uuid, uuid) to service_role;
