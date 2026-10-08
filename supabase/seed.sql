-- PDVastro: dados de exemplo (opcional). Cria 2 eventos com os presets de tema
-- e um cardápio de teste. Pode rodar mais de uma vez: não duplica.

do $$
declare
  v_pagode uuid;
  v_under uuid;
  v_cat uuid;
begin
  insert into public.events (slug, name, venue, ticket_prefix, theme)
  values ('pagode-do-ze', 'Pagode do Zé', 'Zé Beer · Av. Lauro Sodré, 2182', 'A', '{"preset": "pagode"}')
  on conflict (slug) do nothing
  returning id into v_pagode;

  if v_pagode is not null then
    insert into public.categories (event_id, name, position) values (v_pagode, 'Cervejas', 1) returning id into v_cat;
    insert into public.products (event_id, category_id, name, description, price_cents, position) values
      (v_pagode, v_cat, 'Original 600ml', 'Garrafa bem gelada', 1500, 1),
      (v_pagode, v_cat, 'Balde de Original', '5 garrafas 600ml', 5000, 2),
      (v_pagode, v_cat, 'Heineken long neck', null, 1200, 3);

    insert into public.categories (event_id, name, position) values (v_pagode, 'Drinks', 2) returning id into v_cat;
    insert into public.products (event_id, category_id, name, description, price_cents, position) values
      (v_pagode, v_cat, 'Gin Tropical', 'Gin, tônica e frutas', 2500, 1),
      (v_pagode, v_cat, 'Copão de vodka', 'Vodka + energético', 3000, 2),
      (v_pagode, v_cat, 'Caipirinha', 'Limão, cachaça e açúcar', 1800, 3);

    insert into public.categories (event_id, name, position) values (v_pagode, 'Sem álcool', 3) returning id into v_cat;
    insert into public.products (event_id, category_id, name, description, price_cents, position) values
      (v_pagode, v_cat, 'Água', '500ml', 500, 1),
      (v_pagode, v_cat, 'Refrigerante lata', null, 700, 2),
      (v_pagode, v_cat, 'Energético', null, 1500, 3);
  end if;

  insert into public.events (slug, name, venue, ticket_prefix, theme)
  values ('submundo-do-funk', 'Submundo do Funk', 'Oásis Camping Club', 'U', '{"preset": "underground"}')
  on conflict (slug) do nothing
  returning id into v_under;

  if v_under is not null then
    insert into public.categories (event_id, name, position) values (v_under, 'Cervejas', 1) returning id into v_cat;
    insert into public.products (event_id, category_id, name, description, price_cents, position) values
      (v_under, v_cat, 'Heineken long neck', null, 1300, 1),
      (v_under, v_cat, 'Balde Heineken', '5 long necks', 6000, 2);

    insert into public.categories (event_id, name, position) values (v_under, 'Drinks', 2) returning id into v_cat;
    insert into public.products (event_id, category_id, name, description, price_cents, position) values
      (v_under, v_cat, 'Copão de whisky', 'Whisky + energético', 3500, 1),
      (v_under, v_cat, 'Gummy shot', 'Bala de gin', 1000, 2);

    insert into public.categories (event_id, name, position) values (v_under, 'Sem álcool', 3) returning id into v_cat;
    insert into public.products (event_id, category_id, name, description, price_cents, position) values
      (v_under, v_cat, 'Água', '500ml', 500, 1),
      (v_under, v_cat, 'Energético', null, 1500, 2);
  end if;
end $$;
