-- Pulse Stock: esquema inicial
-- Enums, tabelas, restrições e índices. As políticas de RLS entram na
-- migração de perfis de acesso; até lá o RLS fica ativado sem políticas,
-- o que bloqueia todo acesso pela API pública.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.app_role as enum ('admin', 'operator');

create type public.stock_movement_type as enum ('in', 'out', 'adjustment');

create type public.order_status as enum (
  'pending',
  'confirmed',
  'shipped',
  'delivered',
  'cancelled'
);

-- ---------------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Perfis (1:1 com auth.users)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  role public.app_role not null default 'operator',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Categorias
-- ---------------------------------------------------------------------------

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now()
);

create unique index categories_name_key on public.categories (lower(name));

-- ---------------------------------------------------------------------------
-- Produtos
-- ---------------------------------------------------------------------------

create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null check (sku ~ '^[A-Z0-9][A-Z0-9._-]{0,39}$'),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text check (char_length(description) <= 1000),
  category_id uuid references public.categories (id) on delete set null,
  unit text not null default 'UN' check (char_length(unit) between 1 and 10),
  cost_price numeric(12, 2) not null default 0 check (cost_price >= 0),
  sale_price numeric(12, 2) not null check (sale_price >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  min_stock integer not null default 0 check (min_stock >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_sku_key unique (sku)
);

create index products_category_id_idx on public.products (category_id);
create index products_name_idx on public.products (lower(name));

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Clientes
-- ---------------------------------------------------------------------------

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  -- CPF (11 dígitos) ou CNPJ (14 dígitos), só números
  document text check (document ~ '^([0-9]{11}|[0-9]{14})$'),
  email text check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text check (char_length(phone) <= 20),
  city text check (char_length(city) <= 80),
  state char(2) check (state ~ '^[A-Z]{2}$'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_document_key unique (document)
);

create index customers_name_idx on public.customers (lower(name));

create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Pedidos
-- ---------------------------------------------------------------------------

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity,
  customer_id uuid not null references public.customers (id) on delete restrict,
  status public.order_status not null default 'pending',
  total_amount numeric(12, 2) not null default 0 check (total_amount >= 0),
  notes text check (char_length(notes) <= 1000),
  created_by uuid not null default auth.uid() references public.profiles (id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_number_key unique (number),
  constraint orders_confirmed_at_check
    check (status = 'pending' or status = 'cancelled' or confirmed_at is not null)
);

create index orders_customer_id_idx on public.orders (customer_id);
create index orders_status_idx on public.orders (status);
create index orders_created_at_idx on public.orders (created_at desc);
create index orders_created_by_idx on public.orders (created_by);

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  subtotal numeric(12, 2) generated always as (quantity * unit_price) stored,
  created_at timestamptz not null default now(),
  constraint order_items_order_product_key unique (order_id, product_id)
);

create index order_items_product_id_idx on public.order_items (product_id);

-- ---------------------------------------------------------------------------
-- Movimentações de estoque (histórico imutável)
-- ---------------------------------------------------------------------------

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete restrict,
  type public.stock_movement_type not null,
  -- Entradas e saídas usam quantidade positiva; ajuste usa a diferença
  -- com sinal (ex.: -3 para corrigir uma contagem a menor).
  quantity integer not null,
  reason text check (char_length(reason) <= 500),
  order_id uuid references public.orders (id) on delete restrict,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint stock_movements_quantity_check check (
    (type in ('in', 'out') and quantity > 0)
    or (type = 'adjustment' and quantity <> 0)
  )
);

create index stock_movements_product_created_idx
  on public.stock_movements (product_id, created_at desc);
create index stock_movements_order_id_idx on public.stock_movements (order_id);
create index stock_movements_created_by_idx on public.stock_movements (created_by);

-- ---------------------------------------------------------------------------
-- RLS ativado em todas as tabelas (políticas na próxima migração)
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.stock_movements enable row level security;
