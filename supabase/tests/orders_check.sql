-- Verificação dos pedidos: gravação com itens, total, preço congelado,
-- fluxo de status, baixa e devolução de estoque e permissões por perfil.
--
-- Como os outros scripts, roda numa transação e desfaz tudo no final.
--
-- Uso:
--   npx supabase db query --linked -f supabase/tests/orders_check.sql
--
-- Termina com "PEDIDOS OK: N verificações" ou com um erro listando as falhas.

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
--   'rows=N'  o select retornou o número N (contagem ou valor)
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
  ('a0000000-0000-4000-8000-000000000001', 'ped-admin@teste.local', '{"full_name":"Admin Pedidos"}'),
  ('a0000000-0000-4000-8000-000000000002', 'ped-operador@teste.local', '{"full_name":"Operador Pedidos"}'),
  ('a0000000-0000-4000-8000-000000000003', 'ped-inativo@teste.local', '{"full_name":"Inativo Pedidos"}');

update public.profiles set role = 'admin' where id = 'a0000000-0000-4000-8000-000000000001';
update public.profiles set active = false where id = 'a0000000-0000-4000-8000-000000000003';

insert into public.customers (id, name, active) values
  ('d0000000-0000-4000-8000-000000000001', 'Cliente Ativo', true),
  ('d0000000-0000-4000-8000-000000000002', 'Cliente Inativo', false);

insert into public.products (id, sku, name, sale_price, active) values
  ('b0000000-0000-4000-8000-000000000001', 'PED-001', 'Produto Um', 10, true),
  ('b0000000-0000-4000-8000-000000000002', 'PED-002', 'Produto Dois', 20, true),
  ('b0000000-0000-4000-8000-000000000003', 'PED-003', 'Produto Inativo', 30, false);

-- Saldo inicial pelas movimentações (como na vida real): 5 e 1.
insert into public.stock_movements (product_id, type, quantity, created_by) values
  ('b0000000-0000-4000-8000-000000000001', 'in', 5, 'a0000000-0000-4000-8000-000000000001'),
  ('b0000000-0000-4000-8000-000000000002', 'in', 1, 'a0000000-0000-4000-8000-000000000001');

-- ---------------------------------------------------------------------------
-- Verificações
-- ---------------------------------------------------------------------------

do $$
declare
  admin uuid := 'a0000000-0000-4000-8000-000000000001';
  op uuid := 'a0000000-0000-4000-8000-000000000002';
  inativo uuid := 'a0000000-0000-4000-8000-000000000003';
  c1 text := '''d0000000-0000-4000-8000-000000000001''';
  c2 text := '''d0000000-0000-4000-8000-000000000002''';
  p1 text := 'b0000000-0000-4000-8000-000000000001';
  p2 text := 'b0000000-0000-4000-8000-000000000002';
  p3 text := 'b0000000-0000-4000-8000-000000000003';
  pedido_a text := $q$(select id from public.orders where notes = 'A')$q$;
  pedido_b text := $q$(select id from public.orders where notes = 'B')$q$;
  saldo1 text := $q$select stock_quantity from public.products where sku = 'PED-001'$q$;
  saldo2 text := $q$select stock_quantity from public.products where sku = 'PED-002'$q$;
  salvar text := 'select public.save_order(%s, %L::jsonb, %L)';
  status text := 'select public.change_order_status(%s, %L)';
begin
  -- Criação
  perform pg_temp.expect('operador cria pedido com itens', op,
    format(salvar, c1, format('[{"product_id":"%s","quantity":2},{"product_id":"%s","quantity":1},{"product_id":"%s","quantity":1}]', p1, p1, p2), 'A'), 'ok');
  perform pg_temp.expect('pedido nasce pendente e em nome de quem criou', op,
    format('select count(*) from public.orders where id = %s and status = %L and created_by = %L', pedido_a, 'pending', op), 'rows=1');
  perform pg_temp.expect('produto repetido vira um item só', op,
    format('select count(*) from public.order_items where order_id = %s', pedido_a), 'rows=2');
  perform pg_temp.expect('total = soma dos itens com o preço do produto (3×10 + 1×20)', op,
    format('select total_amount::int from public.orders where id = %s', pedido_a), 'rows=50');
  perform pg_temp.expect('cliente inativo é recusado', op,
    format(salvar, c2, format('[{"product_id":"%s","quantity":1}]', p1), 'X'), 'denied');
  perform pg_temp.expect('pedido sem itens é recusado', op, format(salvar, c1, '[]', 'X'), 'denied');
  perform pg_temp.expect('produto inativo é recusado', op,
    format(salvar, c1, format('[{"product_id":"%s","quantity":1}]', p3), 'X'), 'denied');
  perform pg_temp.expect('usuário inativo não cria pedido', inativo,
    format(salvar, c1, format('[{"product_id":"%s","quantity":1}]', p1), 'X'), 'denied');
  perform pg_temp.expect('anon não chama save_order', null,
    format(salvar, c1, format('[{"product_id":"%s","quantity":1}]', p1), 'X'), 'denied');
  perform pg_temp.expect('nenhum pedido recusado ficou gravado', admin,
    $q$select count(*) from public.orders where notes = 'X'$q$, 'rows=0');

  -- Edição enquanto pendente
  perform pg_temp.expect('operador edita itens do pedido pendente', op,
    format('select public.save_order(%s, %L::jsonb, %L, %s)', c1, format('[{"product_id":"%s","quantity":4}]', p1), 'A', pedido_a), 'ok');
  perform pg_temp.expect('total recalculado após a edição', op,
    format('select total_amount::int from public.orders where id = %s', pedido_a), 'rows=40');

  -- Fluxo de status
  perform pg_temp.expect('pendente não pula para enviado', op, format(status, pedido_a, 'shipped'), 'denied');
  perform pg_temp.expect('operador não cancela', op, format(status, pedido_a, 'cancelled'), 'denied');
  perform pg_temp.expect('usuário inativo não confirma', inativo, format(status, pedido_a, 'confirmed'), 'denied');
  perform pg_temp.expect('operador confirma o pedido', op, format(status, pedido_a, 'confirmed'), 'ok');
  perform pg_temp.expect('confirmar baixa o estoque (5 - 4)', op, saldo1, 'rows=1');
  perform pg_temp.expect('confirmação registra data e status', op,
    format('select count(*) from public.orders where id = %s and status = %L and confirmed_at is not null', pedido_a, 'confirmed'), 'rows=1');
  perform pg_temp.expect('baixa fica no histórico ligada ao pedido', op,
    format('select count(*) from public.stock_movements where order_id = %s and type = %L', pedido_a, 'out'), 'rows=1');
  perform pg_temp.expect('pedido confirmado não é mais editado', op,
    format('select public.save_order(%s, %L::jsonb, %L, %s)', c1, format('[{"product_id":"%s","quantity":1}]', p1), 'A', pedido_a), 'denied');
  perform pg_temp.expect('itens de pedido confirmado não mudam', op,
    format('update public.order_items set quantity = 1 where order_id = %s', pedido_a), 'denied');

  -- Estoque insuficiente: nada muda
  perform pg_temp.expect('operador cria pedido B', op,
    format(salvar, c1, format('[{"product_id":"%s","quantity":2},{"product_id":"%s","quantity":1}]', p1, p2), 'B'), 'ok');
  perform pg_temp.expect('confirmar sem saldo é recusado', op, format(status, pedido_b, 'confirmed'), 'denied');
  perform pg_temp.expect('nenhum produto foi baixado (produto 2 continua 1)', op, saldo2, 'rows=1');
  perform pg_temp.expect('pedido B continua pendente', op,
    format('select count(*) from public.orders where id = %s and status = %L', pedido_b, 'pending'), 'rows=1');

  -- Cancelar confirmado devolve o estoque
  perform pg_temp.expect('admin cancela pedido confirmado', admin, format(status, pedido_a, 'cancelled'), 'ok');
  perform pg_temp.expect('estoque devolvido (1 + 4)', admin, saldo1, 'rows=5');
  perform pg_temp.expect('devolução fica no histórico', admin,
    format('select count(*) from public.stock_movements where order_id = %s and type = %L', pedido_a, 'in'), 'rows=1');
  perform pg_temp.expect('pedido cancelado não muda mais', admin, format(status, pedido_a, 'confirmed'), 'denied');

  -- Preço congelado
  perform pg_temp.expect('admin muda o preço do produto 1', admin,
    $q$update public.products set sale_price = 99 where sku = 'PED-001'$q$, 'ok');
  perform pg_temp.expect('pedido B mantém o preço de quando foi criado', op,
    format('select total_amount::int from public.orders where id = %s', pedido_b), 'rows=40');

  -- Caminho completo
  perform pg_temp.expect('agora B confirma', op, format(status, pedido_b, 'confirmed'), 'ok');
  perform pg_temp.expect('saldos após B (5-2 e 1-1)', op,
    $q$select sum(stock_quantity) from public.products where sku in ('PED-001', 'PED-002')$q$, 'rows=3');
  perform pg_temp.expect('operador marca como enviado', op, format(status, pedido_b, 'shipped'), 'ok');
  perform pg_temp.expect('operador marca como entregue', op, format(status, pedido_b, 'delivered'), 'ok');
  perform pg_temp.expect('entregue não é cancelado', admin, format(status, pedido_b, 'cancelled'), 'denied');
  perform pg_temp.expect('status não muda por update direto', admin,
    format('update public.orders set status = %L where id = %s', 'pending', pedido_b), 'denied');
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
    raise exception E'PEDIDOS FALHOU:\n%', failures;
  end if;
  raise notice 'PEDIDOS OK: % verificações', total;
end;
$$;

select label, expected, actual, passed from rls_results;

rollback;
