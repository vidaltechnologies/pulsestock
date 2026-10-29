-- Pulse Stock: perfis de acesso e políticas de RLS
--
-- Regras gerais:
-- - anon (sem login) não acessa nenhuma tabela.
-- - Só usuários com perfil ativo leem ou escrevem dados.
-- - Administrador cadastra produtos e categorias, faz ajustes e saídas
--   manuais de estoque, inativa clientes e gerencia perfis.
-- - Operador consulta tudo, cadastra clientes, cria pedidos e registra
--   entradas de estoque.
-- - Saldo de estoque, status e total do pedido não são alterados direto
--   pela API: isso fica para as funções das etapas de estoque e pedidos.

-- ---------------------------------------------------------------------------
-- Funções auxiliares (schema private, fora da API)
-- ---------------------------------------------------------------------------

create schema if not exists private;

grant usage on schema private to authenticated;

-- security definer: leem profiles sem depender das políticas de profiles,
-- o que evitaria recursão nas próprias políticas.
create function private.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and active
  );
$$;

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and active
      and role = 'admin'
  );
$$;

revoke execute on function private.is_active_user() from public;
revoke execute on function private.is_admin() from public;
grant execute on function private.is_active_user() to authenticated;
grant execute on function private.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Privilégios de tabela
-- ---------------------------------------------------------------------------

-- Sem login, nada.
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

-- Exclusão física não faz parte do sistema: registros são inativados.
-- order_items é a exceção, porque itens de um pedido pendente podem sair.
revoke delete, truncate on all tables in schema public from authenticated;
grant delete on public.order_items to authenticated;

-- Colunas que só mudam pelas funções de estoque e de pedidos.
revoke insert, update on public.products from authenticated;
grant insert (sku, name, description, category_id, unit, cost_price, sale_price, min_stock, active)
  on public.products to authenticated;
grant update (sku, name, description, category_id, unit, cost_price, sale_price, min_stock, active)
  on public.products to authenticated;

revoke insert, update on public.orders from authenticated;
grant insert (customer_id, notes) on public.orders to authenticated;
grant update (customer_id, notes) on public.orders to authenticated;

revoke update on public.stock_movements from authenticated;
revoke insert on public.stock_movements from authenticated;
grant insert (product_id, type, quantity, reason) on public.stock_movements to authenticated;

revoke insert, update on public.order_items from authenticated;
grant insert (order_id, product_id, quantity, unit_price) on public.order_items to authenticated;
grant update (quantity, unit_price) on public.order_items to authenticated;

-- Perfis são criados pelo gatilho de cadastro; a API só altera nome,
-- perfil e status.
revoke insert, update on public.profiles from authenticated;
grant update (full_name, role, active) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create policy "profiles: admin lê todos"
  on public.profiles
  for select
  to authenticated
  using ((select private.is_admin()));

create policy "profiles: admin altera"
  on public.profiles
  for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------

create policy "categories: usuários ativos leem"
  on public.categories
  for select
  to authenticated
  using ((select private.is_active_user()));

create policy "categories: admin cadastra"
  on public.categories
  for insert
  to authenticated
  with check ((select private.is_admin()));

create policy "categories: admin altera"
  on public.categories
  for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------

create policy "products: usuários ativos leem"
  on public.products
  for select
  to authenticated
  using ((select private.is_active_user()));

create policy "products: admin cadastra"
  on public.products
  for insert
  to authenticated
  with check ((select private.is_admin()));

create policy "products: admin altera"
  on public.products
  for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------------

create policy "customers: usuários ativos leem"
  on public.customers
  for select
  to authenticated
  using ((select private.is_active_user()));

create policy "customers: usuários ativos cadastram"
  on public.customers
  for insert
  to authenticated
  with check ((select private.is_active_user()) and active);

create policy "customers: usuários ativos alteram"
  on public.customers
  for update
  to authenticated
  using ((select private.is_active_user()))
  with check ((select private.is_active_user()));

-- Inativar ou reativar cliente é só do administrador. RLS não compara o
-- valor antigo com o novo, então a regra fica num gatilho.
create function private.customers_guard_active()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Sem auth.uid() é uma rotina do servidor (service role ou SQL do painel).
  if new.active is distinct from old.active
     and (select auth.uid()) is not null
     and not private.is_admin() then
    raise exception 'Apenas administradores podem inativar ou reativar clientes.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger customers_guard_active
  before update on public.customers
  for each row execute function private.customers_guard_active();

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------

create policy "orders: usuários ativos leem"
  on public.orders
  for select
  to authenticated
  using ((select private.is_active_user()));

create policy "orders: usuários ativos criam em nome próprio"
  on public.orders
  for insert
  to authenticated
  with check (
    (select private.is_active_user())
    and created_by = (select auth.uid())
    and status = 'pending'
  );

create policy "orders: usuários ativos editam pedidos pendentes"
  on public.orders
  for update
  to authenticated
  using ((select private.is_active_user()) and status = 'pending')
  with check ((select private.is_active_user()) and status = 'pending');

-- ---------------------------------------------------------------------------
-- order_items (só enquanto o pedido está pendente)
-- ---------------------------------------------------------------------------

create function private.is_pending_order(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.orders where id = p_order_id and status = 'pending'
  );
$$;

revoke execute on function private.is_pending_order(uuid) from public;
grant execute on function private.is_pending_order(uuid) to authenticated;

create policy "order_items: usuários ativos leem"
  on public.order_items
  for select
  to authenticated
  using ((select private.is_active_user()));

create policy "order_items: usuários ativos incluem em pedido pendente"
  on public.order_items
  for insert
  to authenticated
  with check ((select private.is_active_user()) and private.is_pending_order(order_id));

create policy "order_items: usuários ativos alteram em pedido pendente"
  on public.order_items
  for update
  to authenticated
  using ((select private.is_active_user()) and private.is_pending_order(order_id))
  with check ((select private.is_active_user()) and private.is_pending_order(order_id));

create policy "order_items: usuários ativos removem de pedido pendente"
  on public.order_items
  for delete
  to authenticated
  using ((select private.is_active_user()) and private.is_pending_order(order_id));

-- ---------------------------------------------------------------------------
-- stock_movements (histórico imutável)
-- ---------------------------------------------------------------------------

create policy "stock_movements: usuários ativos leem"
  on public.stock_movements
  for select
  to authenticated
  using ((select private.is_active_user()));

-- Entradas: qualquer usuário ativo. Saídas manuais e ajustes: só admin.
-- Movimentações ligadas a pedidos são criadas pelas funções de pedido.
create policy "stock_movements: registro manual conforme o perfil"
  on public.stock_movements
  for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and order_id is null
    and (
      (type = 'in' and (select private.is_active_user()))
      or (type in ('out', 'adjustment') and (select private.is_admin()))
    )
  );
