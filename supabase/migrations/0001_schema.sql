-- PDVastro: schema principal
-- Rodar no SQL Editor do Supabase, nesta ordem: 0001_schema.sql, 0002_functions.sql, (opcional) seed.sql
-- (gen_random_uuid() é nativo do Postgres 13+, não precisa de extensão)

-- ---------------------------------------------------------------------------
-- Eventos (cada evento tem tema e cardápio próprios)
-- ---------------------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  name text not null check (length(name) between 1 and 120),
  venue text,
  starts_at date not null default current_date,
  ticket_prefix text not null default 'A' check (ticket_prefix ~ '^[A-Z]{1,2}$'),
  pix_expiration_seconds int not null default 300 check (pix_expiration_seconds between 30 and 3600),
  theme jsonb not null default '{"preset": "pagode"}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null check (length(name) between 1 and 60),
  position int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, event_id)
);
create index categories_event_idx on public.categories (event_id, position);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  category_id uuid not null,
  name text not null check (length(name) between 1 and 80),
  description text check (description is null or length(description) <= 200),
  price_cents int not null check (price_cents > 0),
  image_url text,
  position int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  -- garante que a categoria é do mesmo evento do produto
  foreign key (category_id, event_id) references public.categories (id, event_id) on delete cascade
);
create index products_event_idx on public.products (event_id, category_id, position);

-- ---------------------------------------------------------------------------
-- Totens (dispositivos pareados por token; só o hash fica no banco)
-- ---------------------------------------------------------------------------
create table public.totems (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 60),
  event_id uuid references public.events(id) on delete set null,
  token_hash text unique,
  paper_width_mm int not null default 80 check (paper_width_mm in (58, 80)),
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

-- Usuários do Supabase Auth autorizados no painel
create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Pedidos
-- ---------------------------------------------------------------------------
-- Senha sequencial por evento e "dia operacional" (virada às 06:00 de Porto Velho)
create table public.ticket_counters (
  event_id uuid not null references public.events(id) on delete cascade,
  business_date date not null,
  last_number int not null default 0,
  primary key (event_id, business_date)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id),
  totem_id uuid references public.totems(id) on delete set null,
  business_date date not null,
  -- senha só é gerada quando o Pix é confirmado (não "queima" número com pedido expirado)
  ticket_number int,
  ticket_code text,
  status text not null default 'aguardando_pagamento'
    check (status in ('aguardando_pagamento', 'pago', 'expirado', 'cancelado')),
  total_cents int not null check (total_cents > 0),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  printed_at timestamptz,
  print_count int not null default 0,
  unique (event_id, business_date, ticket_number)
);
create index orders_event_day_idx on public.orders (event_id, business_date, created_at desc);
create index orders_ticket_idx on public.orders (ticket_code);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name_snapshot text not null,
  unit_price_cents int not null check (unit_price_cents >= 0),
  quantity int not null check (quantity between 1 and 99)
);
create index order_items_order_idx on public.order_items (order_id);

-- ---------------------------------------------------------------------------
-- Pagamentos Pix
-- ---------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null,                       -- 'itau' | 'mock' | ...
  txid text not null unique,                    -- gerado por nós (26 a 35 alfanuméricos)
  pix_copia_cola text,
  amount_cents int not null check (amount_cents > 0),
  paid_amount_cents int,
  status text not null default 'pendente'
    check (status in ('pendente', 'pago', 'expirado', 'cancelado', 'divergente', 'duplicado')),
  e2e_id text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  last_checked_at timestamptz,
  raw_provider jsonb
);
create index payments_order_idx on public.payments (order_id);
create index payments_open_idx on public.payments (created_at)
  where status in ('pendente', 'expirado', 'cancelado');

-- Cobranças do provedor "mock" (só para desenvolvimento, PIX_PROVIDER=mock)
create table public.mock_pix_charges (
  txid text primary key,
  amount_cents int not null,
  paid_cents int,
  removed boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Fila de impressão (ficha original e reimpressões)
-- ---------------------------------------------------------------------------
create table public.print_jobs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  totem_id uuid references public.totems(id) on delete set null,
  kind text not null check (kind in ('original', 'reprint')),
  status text not null default 'pendente' check (status in ('pendente', 'impresso', 'cancelado')),
  created_at timestamptz not null default now(),
  printed_at timestamptz
);
create unique index print_jobs_one_original on public.print_jobs (order_id) where kind = 'original';
create index print_jobs_pending_idx on public.print_jobs (totem_id, created_at) where status = 'pendente';

-- ---------------------------------------------------------------------------
-- RLS: ligado em tudo e SEM policies. O navegador nunca acessa as tabelas;
-- totem e painel passam pelas rotas do servidor (chave secreta).
-- ---------------------------------------------------------------------------
alter table public.events enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.totems enable row level security;
alter table public.admins enable row level security;
alter table public.ticket_counters enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.mock_pix_charges enable row level security;
alter table public.print_jobs enable row level security;

-- ---------------------------------------------------------------------------
-- Storage: bucket público para logos, fundos e fotos de produtos
-- (upload só pelo servidor)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('assets', 'assets', true)
on conflict (id) do nothing;
