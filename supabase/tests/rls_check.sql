-- Verificação das regras de acesso (RLS e privilégios) por perfil.
--
-- Roda tudo dentro de uma transação e desfaz no final (ROLLBACK): cria
-- usuários e dados de teste, testa cada operação como admin, operador,
-- usuário inativo e anônimo, e não deixa nada gravado no banco.
--
-- Uso:
--   npx supabase db query --linked -f supabase/tests/rls_check.sql   (nuvem)
--   npx supabase db query --local  -f supabase/tests/rls_check.sql   (Docker)
--
-- Termina com "RLS OK: N verificações" ou com um erro listando as falhas.

begin;

create temp table rls_results (
  label text not null,
  expected text not null,
  actual text not null,
  passed boolean not null
) on commit drop;

-- Executa `sql` como o usuário `uid` (null = anon) e compara o resultado:
--   'ok'      a operação passou e afetou ao menos uma linha
--   'denied'  a operação falhou ou não afetou/retornou nenhuma linha
--   'rows=N'  o select retornou o número N
create function pg_temp.expect(label text, uid uuid, sql text, expected text)
returns void
language plpgsql
as $$
declare
  affected bigint;
  scalar bigint;
  actual text;
begin
  perform set_config(
    'request.jwt.claims',
    case when uid is null then '{"role":"anon"}'
         else json_build_object('sub', uid, 'role', 'authenticated')::text end,
    true
  );
  if uid is null then
    execute 'set local role anon';
  else
    execute 'set local role authenticated';
  end if;

  begin
    if expected like 'rows=%' then
      execute sql into scalar;
      actual := 'rows=' || coalesce(scalar, 0);
    else
      execute sql;
      get diagnostics affected = row_count;
      actual := case when affected > 0 then 'ok' else 'denied' end;
    end if;
  exception when others then
    actual := case when expected like 'rows=%' then 'erro: ' || sqlerrm else 'denied' end;
  end;

  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);

  insert into rls_results values (label, expected, actual, actual = expected);
end;
$$;

-- ---------------------------------------------------------------------------
-- Dados de teste
-- ---------------------------------------------------------------------------

insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-4000-8000-000000000001', 'rls-admin@teste.local', '{"full_name":"Admin Teste"}'),
  ('a0000000-0000-4000-8000-000000000002', 'rls-operador@teste.local', '{"full_name":"Operador Teste"}'),
  ('a0000000-0000-4000-8000-000000000003', 'rls-inativo@teste.local', '{"full_name":"Inativo Teste"}');

update public.profiles set role = 'admin' where id = 'a0000000-0000-4000-8000-000000000001';
update public.profiles set active = false where id = 'a0000000-0000-4000-8000-000000000003';

insert into public.categories (id, name)
  values ('c0000000-0000-4000-8000-000000000001', 'Categoria RLS');
insert into public.products (id, sku, name, sale_price, stock_quantity)
  values ('b0000000-0000-4000-8000-000000000001', 'RLS-001', 'Produto RLS', 10, 5);
insert into public.customers (id, name)
  values ('d0000000-0000-4000-8000-000000000001', 'Cliente RLS');
insert into public.orders (id, customer_id, created_by)
  values ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002');
insert into public.orders (id, customer_id, created_by, status, confirmed_at)
  values ('e0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'confirmed', now());
insert into public.order_items (order_id, product_id, quantity, unit_price) values
  ('e0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 1, 10),
  ('e0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 1, 10);

-- ---------------------------------------------------------------------------
-- Verificações
-- ---------------------------------------------------------------------------

do $$
declare
  admin uuid := 'a0000000-0000-4000-8000-000000000001';
  op uuid := 'a0000000-0000-4000-8000-000000000002';
  inativo uuid := 'a0000000-0000-4000-8000-000000000003';
  produto text := '''b0000000-0000-4000-8000-000000000001''';
  cliente text := '''d0000000-0000-4000-8000-000000000001''';
  pendente text := '''e0000000-0000-4000-8000-000000000001''';
  confirmado text := '''e0000000-0000-4000-8000-000000000002''';
begin
  -- Anônimo não vê nada
  perform pg_temp.expect('anon lê produtos', null, 'select * from public.products', 'denied');
  perform pg_temp.expect('anon lê perfis', null, 'select * from public.profiles', 'denied');
  perform pg_temp.expect('anon cria cliente', null, $q$insert into public.customers (name) values ('X')$q$, 'denied');

  -- Usuário inativo não vê nada
  perform pg_temp.expect('inativo lê produtos', inativo, 'select count(*) from public.products', 'rows=0');
  perform pg_temp.expect('inativo cria cliente', inativo, $q$insert into public.customers (name) values ('X')$q$, 'denied');

  -- Perfis
  perform pg_temp.expect('operador lê só o próprio perfil', op, 'select count(*) from public.profiles', 'rows=1');
  perform pg_temp.expect('admin lê todos os perfis', admin, $q$select count(*) from public.profiles where id in ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000003')$q$, 'rows=3');
  perform pg_temp.expect('operador vira admin sozinho', op, $q$update public.profiles set role = 'admin' where id = 'a0000000-0000-4000-8000-000000000002'$q$, 'denied');
  perform pg_temp.expect('admin muda perfil de outro', admin, $q$update public.profiles set full_name = 'Operador Renomeado' where id = 'a0000000-0000-4000-8000-000000000002'$q$, 'ok');
  perform pg_temp.expect('admin cria perfil direto', admin, $q$insert into public.profiles (id) values (gen_random_uuid())$q$, 'denied');

  -- Categorias e produtos
  perform pg_temp.expect('operador lê produtos', op, $q$select count(*) from public.products where sku = 'RLS-001'$q$, 'rows=1');
  perform pg_temp.expect('operador cria produto', op, $q$insert into public.products (sku, name, sale_price) values ('RLS-OP', 'X', 1)$q$, 'denied');
  perform pg_temp.expect('operador altera produto', op, format('update public.products set name = %L where id = %s', 'Y', produto), 'denied');
  perform pg_temp.expect('operador cria categoria', op, $q$insert into public.categories (name) values ('Cat Op')$q$, 'denied');
  perform pg_temp.expect('admin cria produto', admin, $q$insert into public.products (sku, name, sale_price) values ('RLS-ADM', 'X', 1)$q$, 'ok');
  perform pg_temp.expect('admin altera produto', admin, format('update public.products set name = %L where id = %s', 'Produto RLS 2', produto), 'ok');
  perform pg_temp.expect('admin cria categoria', admin, $q$insert into public.categories (name) values ('Cat Admin')$q$, 'ok');
  perform pg_temp.expect('admin altera saldo direto', admin, format('update public.products set stock_quantity = 99 where id = %s', produto), 'denied');
  perform pg_temp.expect('admin cria produto com saldo', admin, $q$insert into public.products (sku, name, sale_price, stock_quantity) values ('RLS-SALDO', 'X', 1, 50)$q$, 'denied');
  perform pg_temp.expect('admin exclui produto', admin, format('delete from public.products where id = %s', produto), 'denied');

  -- Clientes
  perform pg_temp.expect('operador cria cliente', op, $q$insert into public.customers (name) values ('Cliente Op')$q$, 'ok');
  perform pg_temp.expect('operador edita cliente', op, format('update public.customers set phone = %L where id = %s', '11999990000', cliente), 'ok');
  perform pg_temp.expect('operador inativa cliente', op, format('update public.customers set active = false where id = %s', cliente), 'denied');
  perform pg_temp.expect('operador cria cliente já inativo', op, $q$insert into public.customers (name, active) values ('Cliente Inativo', false)$q$, 'denied');
  perform pg_temp.expect('admin inativa cliente', admin, format('update public.customers set active = false where id = %s', cliente), 'ok');
  perform pg_temp.expect('admin exclui cliente', admin, format('delete from public.customers where id = %s', cliente), 'denied');

  -- Pedidos
  perform pg_temp.expect('operador cria pedido', op, format('insert into public.orders (customer_id) values (%s)', cliente), 'ok');
  perform pg_temp.expect('operador cria pedido em nome de outro', op, format('insert into public.orders (customer_id, created_by) values (%s, ''a0000000-0000-4000-8000-000000000001'')', cliente), 'denied');
  perform pg_temp.expect('operador cria pedido já confirmado', op, format($q$insert into public.orders (customer_id, status) values (%s, 'confirmed')$q$, cliente), 'denied');
  perform pg_temp.expect('operador edita pedido pendente', op, format('update public.orders set notes = %L where id = %s', 'obs', pendente), 'ok');
  perform pg_temp.expect('operador edita pedido confirmado', op, format('update public.orders set notes = %L where id = %s', 'obs', confirmado), 'denied');
  perform pg_temp.expect('admin muda status direto', admin, format($q$update public.orders set status = 'cancelled' where id = %s$q$, pendente), 'denied');
  perform pg_temp.expect('admin muda total direto', admin, format('update public.orders set total_amount = 1 where id = %s', pendente), 'denied');

  -- Itens do pedido
  perform pg_temp.expect('operador altera item de pedido pendente', op, format('update public.order_items set quantity = 2 where order_id = %s', pendente), 'ok');
  perform pg_temp.expect('operador altera item de pedido confirmado', op, format('update public.order_items set quantity = 2 where order_id = %s', confirmado), 'denied');
  perform pg_temp.expect('operador remove item de pedido confirmado', op, format('delete from public.order_items where order_id = %s', confirmado), 'denied');
  perform pg_temp.expect('operador remove item de pedido pendente', op, format('delete from public.order_items where order_id = %s', pendente), 'ok');

  -- Movimentações de estoque
  perform pg_temp.expect('operador registra entrada', op, format($q$insert into public.stock_movements (product_id, type, quantity) values (%s, 'in', 3)$q$, produto), 'ok');
  perform pg_temp.expect('operador registra saída manual', op, format($q$insert into public.stock_movements (product_id, type, quantity) values (%s, 'out', 1)$q$, produto), 'denied');
  perform pg_temp.expect('operador registra ajuste', op, format($q$insert into public.stock_movements (product_id, type, quantity) values (%s, 'adjustment', -1)$q$, produto), 'denied');
  perform pg_temp.expect('operador registra em nome de outro', op, format($q$insert into public.stock_movements (product_id, type, quantity, created_by) values (%s, 'in', 1, 'a0000000-0000-4000-8000-000000000001')$q$, produto), 'denied');
  perform pg_temp.expect('operador vincula a pedido', op, format($q$insert into public.stock_movements (product_id, type, quantity, order_id) values (%s, 'in', 1, %s)$q$, produto, pendente), 'denied');
  perform pg_temp.expect('admin registra ajuste', admin, format($q$insert into public.stock_movements (product_id, type, quantity) values (%s, 'adjustment', -1)$q$, produto), 'ok');
  perform pg_temp.expect('admin altera movimentação', admin, $q$update public.stock_movements set quantity = 100$q$, 'denied');
  perform pg_temp.expect('admin exclui movimentação', admin, $q$delete from public.stock_movements$q$, 'denied');
end;
$$;

-- ---------------------------------------------------------------------------
-- Resultado
-- ---------------------------------------------------------------------------

do $$
declare
  failures text;
  total int;
begin
  select count(*) into total from rls_results;
  select string_agg(format('%s (esperado %s, obtido %s)', label, expected, actual), E'\n')
    into failures
    from rls_results
    where not passed;

  if failures is not null then
    raise exception E'RLS FALHOU:\n%', failures;
  end if;
  raise notice 'RLS OK: % verificações', total;
end;
$$;

select label, expected, actual, passed from rls_results;

rollback;
