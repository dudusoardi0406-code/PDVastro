-- PDVastro: dados de exemplo (opcional). Rodar depois das migrações 0001, 0002 e 0003.
-- Cria 2 eventos com os temas prontos e um cardápio de teste. Pode rodar mais de uma
-- vez: só cria o que ainda não existe (evento por slug, categoria e produto por nome).

create or replace function pg_temp.seed_event(p_slug text, p_name text, p_venue text, p_prefix text, p_preset text)
returns uuid language plpgsql as $$
declare v uuid;
begin
  select id into v from public.events where slug = p_slug;
  if v is null then
    insert into public.events (slug, name, venue, ticket_prefix, theme)
    values (p_slug, p_name, p_venue, p_prefix, jsonb_build_object('preset', p_preset))
    returning id into v;
  end if;
  return v;
end $$;

create or replace function pg_temp.seed_cat(p_event uuid, p_name text, p_position int, p_featured boolean default false, p_subtitle text default null)
returns uuid language plpgsql as $$
declare v uuid;
begin
  select id into v from public.categories where event_id = p_event and name = p_name;
  if v is null then
    insert into public.categories (event_id, name, position, featured, subtitle)
    values (p_event, p_name, p_position, p_featured, p_subtitle)
    returning id into v;
  end if;
  return v;
end $$;

create or replace function pg_temp.seed_prod(p_cat uuid, p_name text, p_price int, p_description text default null, p_compare_at int default null)
returns void language plpgsql as $$
declare v_event uuid; v_pos int;
begin
  if exists (select 1 from public.products where category_id = p_cat and name = p_name) then
    return;
  end if;
  select event_id into v_event from public.categories where id = p_cat;
  select coalesce(max(position), 0) + 1 into v_pos from public.products where category_id = p_cat;
  insert into public.products (event_id, category_id, name, description, price_cents, compare_at_cents, position)
  values (v_event, p_cat, p_name, p_description, p_price, p_compare_at, v_pos);
end $$;

do $$
declare
  e uuid;
  c uuid;
begin
  -- Pagode do Zé (tem comidas) ------------------------------------------------
  e := pg_temp.seed_event('pagode-do-ze', 'Pagode do Zé', 'Zé Beer · Av. Lauro Sodré, 2182', 'A', 'pagode');

  c := pg_temp.seed_cat(e, 'Promoções do dia', 0, true, 'Válidas até as 22h');
  perform pg_temp.seed_prod(c, 'Gin Tropical em dobro', 2500, '2 drinks pelo preço de 1', 5000);
  perform pg_temp.seed_prod(c, 'Balde de Original', 5000, '5 garrafas 600ml', 6000);
  perform pg_temp.seed_prod(c, 'Copão de vodka 50% OFF', 1500, 'Vodka + energético', 3000);

  c := pg_temp.seed_cat(e, 'Cervejas', 1);
  perform pg_temp.seed_prod(c, 'Original 600ml', 1500, 'Garrafa bem gelada');
  perform pg_temp.seed_prod(c, 'Heineken long neck', 1200);
  perform pg_temp.seed_prod(c, 'Spaten long neck', 1200);

  c := pg_temp.seed_cat(e, 'Drinks', 2);
  perform pg_temp.seed_prod(c, 'Gin Tropical', 2500, 'Gin, tônica e frutas');
  perform pg_temp.seed_prod(c, 'Copão de vodka', 3000, 'Vodka + energético');
  perform pg_temp.seed_prod(c, 'Caipirinha', 1800, 'Limão, cachaça e açúcar');

  c := pg_temp.seed_cat(e, 'Comidas', 3);
  perform pg_temp.seed_prod(c, 'Porção de batata frita', 3200, 'Serve 2 pessoas');
  perform pg_temp.seed_prod(c, 'Calabresa acebolada', 3800, 'Com pão');
  perform pg_temp.seed_prod(c, 'Isca de frango', 4200, 'Com molho da casa');
  perform pg_temp.seed_prod(c, 'Espetinho de carne', 1200, 'Com farofa');

  c := pg_temp.seed_cat(e, 'Sem álcool', 4);
  perform pg_temp.seed_prod(c, 'Água', 500, '500ml');
  perform pg_temp.seed_prod(c, 'Refrigerante lata', 700);
  perform pg_temp.seed_prod(c, 'Energético', 1500);

  -- Submundo do Funk (sem comidas) --------------------------------------------
  e := pg_temp.seed_event('submundo-do-funk', 'Submundo do Funk', 'Oásis Camping Club', 'U', 'underground');

  c := pg_temp.seed_cat(e, 'Promoções do dia', 0, true, 'Open gummy até 00h');
  perform pg_temp.seed_prod(c, 'Balde Heineken', 6000, '5 long necks', 7000);
  perform pg_temp.seed_prod(c, 'Combo copão + energético', 4000, 'Whisky ou vodka', 5000);

  c := pg_temp.seed_cat(e, 'Cervejas', 1);
  perform pg_temp.seed_prod(c, 'Heineken long neck', 1300);
  perform pg_temp.seed_prod(c, 'Amstel lata', 900);

  c := pg_temp.seed_cat(e, 'Drinks', 2);
  perform pg_temp.seed_prod(c, 'Copão de whisky', 3500, 'Whisky + energético');
  perform pg_temp.seed_prod(c, 'Gummy shot', 1000, 'Bala de gin');
  perform pg_temp.seed_prod(c, 'Vodka com energético', 3000);

  c := pg_temp.seed_cat(e, 'Sem álcool', 3);
  perform pg_temp.seed_prod(c, 'Água', 500, '500ml');
  perform pg_temp.seed_prod(c, 'Energético', 1500);
end $$;
