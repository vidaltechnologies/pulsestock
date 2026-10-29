-- Verificação dos indicadores do dashboard: os números de
-- dashboard_summary() conferem com os pedidos de teste, com o fuso de São
-- Paulo e com o perfil de quem consulta.
--
-- O projeto pode já ter pedidos de verdade, então o script guarda o
-- resultado antes de criar os dados de teste e confere as diferenças. Como
-- os outros scripts, roda numa transação e desfaz tudo no final.
--
-- Uso:
--   npx supabase db query --linked -f supabase/tests/dashboard_check.sql
--
-- Termina com "DASHBOARD OK: N verificações" ou com um erro listando as falhas.

begin;

create temp table rls_results (
  label text not null,
  expected text not null,
  actual text not null,
  passed boolean not null
) on commit drop;

-- Chama dashboard_summary(days) como o usuário `uid` (null = anon).
-- Devolve null se a chamada falhar.
create function pg_temp.dash(uid uuid, days integer default 30)
returns jsonb
language plpgsql
as $$
declare
  result jsonb;
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
    execute 'select public.dashboard_summary($1)' into result using days;
  exception when others then
    result := null;
  end;

  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  return result;
end;
$$;

-- Executa `sql` como o usuário `uid`, para criar os dados pelo mesmo caminho do app.
create function pg_temp.run_as(uid uuid, sql text)
returns text
language plpgsql
as $$
declare
  result text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  execute sql into result;
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  return result;
end;
$$;

create function pg_temp.check(label text, expected anycompatible, actual anycompatible)
returns void
language sql
as $$
  insert into rls_results
    values (label, coalesce(expected::text, 'null'), coalesce(actual::text, 'null'),
            expected is not distinct from actual);
$$;

-- Total de vendas de um dia em salesByDay.
create function pg_temp.day_total(summary jsonb, day date)
returns numeric
language sql
as $$
  select coalesce(sum((d->>'total')::numeric), 0)
  from jsonb_array_elements(summary->'salesByDay') d
  where (d->>'day')::date = day;
$$;

create function pg_temp.status_count(summary jsonb, status text)
returns integer
language sql
as $$
  select coalesce((summary->'ordersByStatus'->>status)::integer, 0);
$$;

-- ---------------------------------------------------------------------------
-- Usuários de teste e resultado antes dos dados
-- ---------------------------------------------------------------------------

insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-4000-8000-000000000001', 'dash-admin@teste.local', '{"full_name":"Admin Dashboard"}'),
  ('a0000000-0000-4000-8000-000000000002', 'dash-operador@teste.local', '{"full_name":"Operador Dashboard"}'),
  ('a0000000-0000-4000-8000-000000000003', 'dash-inativo@teste.local', '{"full_name":"Inativo Dashboard"}');

update public.profiles set role = 'admin' where id = 'a0000000-0000-4000-8000-000000000001';
update public.profiles set active = false where id = 'a0000000-0000-4000-8000-000000000003';

create temp table baseline on commit drop as
  select pg_temp.dash('a0000000-0000-4000-8000-000000000001') as summary;

-- ---------------------------------------------------------------------------
-- Pedidos de teste
-- ---------------------------------------------------------------------------
--
-- Produto 1: venda 1000, custo 600. Produto 2: venda 2500, custo 1000.
-- Saldo inicial de 100 cada.
--
-- X  3×P1 + 1×P2 = 5500  confirmado hoje às 12h (São Paulo)
-- Y  2×P1        = 2000  entregue, confirmado ontem às 23h de São Paulo
--                         (já é hoje em UTC: testa o fuso)
-- Z  2×P2        = 5000  pendente (não é venda)
-- W  1×P1        = 1000  confirmado e cancelado (não é venda; estoque volta)
-- V  1×P2        = 2500  confirmado há 40 dias (fora do mês e do período)

insert into public.customers (id, name) values
  ('d0000000-0000-4000-8000-000000000001', 'Cliente Dashboard');

insert into public.products (id, sku, name, cost_price, sale_price) values
  ('b0000000-0000-4000-8000-000000000001', 'DASH-001', 'Produto Dashboard Um', 600, 1000),
  ('b0000000-0000-4000-8000-000000000002', 'DASH-002', 'Produto Dashboard Dois', 1000, 2500);

insert into public.stock_movements (product_id, type, quantity, created_by) values
  ('b0000000-0000-4000-8000-000000000001', 'in', 100, 'a0000000-0000-4000-8000-000000000001'),
  ('b0000000-0000-4000-8000-000000000002', 'in', 100, 'a0000000-0000-4000-8000-000000000001');

do $$
declare
  admin uuid := 'a0000000-0000-4000-8000-000000000001';
  op uuid := 'a0000000-0000-4000-8000-000000000002';
  c1 text := '''d0000000-0000-4000-8000-000000000001''';
  p1 text := 'b0000000-0000-4000-8000-000000000001';
  p2 text := 'b0000000-0000-4000-8000-000000000002';
  salvar text := 'select public.save_order(%s, %L::jsonb, %L)';
  status text := 'select public.change_order_status(%L, %L)';
  today date := (now() at time zone 'America/Sao_Paulo')::date;
  x uuid; y uuid; z uuid; w uuid; v uuid;
begin
  x := pg_temp.run_as(op, format(salvar, c1, format('[{"product_id":"%s","quantity":3},{"product_id":"%s","quantity":1}]', p1, p2), 'DASH X'));
  y := pg_temp.run_as(op, format(salvar, c1, format('[{"product_id":"%s","quantity":2}]', p1), 'DASH Y'));
  z := pg_temp.run_as(op, format(salvar, c1, format('[{"product_id":"%s","quantity":2}]', p2), 'DASH Z'));
  w := pg_temp.run_as(op, format(salvar, c1, format('[{"product_id":"%s","quantity":1}]', p1), 'DASH W'));
  v := pg_temp.run_as(op, format(salvar, c1, format('[{"product_id":"%s","quantity":1}]', p2), 'DASH V'));

  perform pg_temp.run_as(op, format(status, x, 'confirmed'));
  perform pg_temp.run_as(op, format(status, y, 'confirmed'));
  perform pg_temp.run_as(op, format(status, y, 'shipped'));
  perform pg_temp.run_as(op, format(status, y, 'delivered'));
  perform pg_temp.run_as(op, format(status, w, 'confirmed'));
  perform pg_temp.run_as(admin, format(status, w, 'cancelled'));
  perform pg_temp.run_as(op, format(status, v, 'confirmed'));

  -- Datas de confirmação controladas (como superusuário, só no teste).
  update public.orders set confirmed_at = (today + time '12:00') at time zone 'America/Sao_Paulo' where id = x;
  update public.orders set confirmed_at = (today - 1 + time '23:00') at time zone 'America/Sao_Paulo' where id = y;
  update public.orders set confirmed_at = (today - 40 + time '12:00') at time zone 'America/Sao_Paulo' where id = v;
end;
$$;

-- ---------------------------------------------------------------------------
-- Verificações
-- ---------------------------------------------------------------------------

do $$
declare
  admin uuid := 'a0000000-0000-4000-8000-000000000001';
  op uuid := 'a0000000-0000-4000-8000-000000000002';
  inativo uuid := 'a0000000-0000-4000-8000-000000000003';
  before jsonb := (select summary from baseline);
  after jsonb := pg_temp.dash(admin);
  as_op jsonb := pg_temp.dash(op);
  today date := (now() at time zone 'America/Sao_Paulo')::date;
  -- Y (ontem) só conta no mês se ontem ainda for deste mês.
  y_in_month boolean := (today - 1) >= date_trunc('month', today)::date;
  top jsonb;
begin
  perform pg_temp.check('chamada do admin funciona', true, after is not null);
  perform pg_temp.check('hoje no fuso de São Paulo', today::text, after->>'today');

  -- Vendas do mês: X, e Y se ontem for deste mês. Z, W e V ficam fora.
  perform pg_temp.check('vendas do mês somam só pedidos confirmados, enviados ou entregues',
    5500 + case when y_in_month then 2000 else 0 end,
    (after->>'monthSales')::numeric - (before->>'monthSales')::numeric);
  perform pg_temp.check('pedidos vendidos no mês',
    1 + case when y_in_month then 1 else 0 end,
    (after->>'monthOrders')::int - (before->>'monthOrders')::int);
  perform pg_temp.check('ticket médio = vendas do mês ÷ pedidos do mês',
    round((after->>'monthSales')::numeric / nullif((after->>'monthOrders')::numeric, 0), 2),
    (after->>'averageTicket')::numeric);

  -- Vendas por dia, no fuso de São Paulo.
  perform pg_temp.check('série tem um ponto por dia do período (30)', 30, jsonb_array_length(after->'salesByDay'));
  perform pg_temp.check('série começa 29 dias antes de hoje', (today - 29)::text, after->'salesByDay'->0->>'day');
  perform pg_temp.check('venda de hoje cai em hoje',
    5500::numeric, pg_temp.day_total(after, today) - pg_temp.day_total(before, today));
  perform pg_temp.check('venda das 23h de ontem (São Paulo) cai em ontem, não em hoje',
    2000::numeric, pg_temp.day_total(after, today - 1) - pg_temp.day_total(before, today - 1));
  perform pg_temp.check('venda de 40 dias atrás fica fora da série',
    (select sum((d->>'total')::numeric) from jsonb_array_elements(before->'salesByDay') d) + 7500,
    (select sum((d->>'total')::numeric) from jsonb_array_elements(after->'salesByDay') d));
  perform pg_temp.check('período de 7 dias tem 7 pontos', 7, jsonb_array_length(pg_temp.dash(admin, 7)->'salesByDay'));
  perform pg_temp.check('período inválido é recusado', true, pg_temp.dash(admin, 0) is null);

  -- Contagens.
  perform pg_temp.check('pedidos pendentes', 1, (after->>'pendingOrders')::int - (before->>'pendingOrders')::int);
  perform pg_temp.check('pedidos por status: pendente', 1, pg_temp.status_count(after, 'pending') - pg_temp.status_count(before, 'pending'));
  perform pg_temp.check('pedidos por status: confirmado (X e V)', 2, pg_temp.status_count(after, 'confirmed') - pg_temp.status_count(before, 'confirmed'));
  perform pg_temp.check('pedidos por status: entregue', 1, pg_temp.status_count(after, 'delivered') - pg_temp.status_count(before, 'delivered'));
  perform pg_temp.check('pedidos por status: cancelado', 1, pg_temp.status_count(after, 'cancelled') - pg_temp.status_count(before, 'cancelled'));

  -- Mais vendidos no período: P1 = 3 + 2 unidades (W cancelado e Z pendente não contam).
  select t into top from jsonb_array_elements(after->'topProducts') t where t->>'sku' = 'DASH-001';
  perform pg_temp.check('mais vendidos: quantidade do produto 1', 5, (top->>'quantity')::int);
  perform pg_temp.check('mais vendidos: valor do produto 1', 5000::numeric, (top->>'total')::numeric);
  perform pg_temp.check('mais vendidos: no máximo 5', true, jsonb_array_length(after->'topProducts') <= 5);

  -- Margem e estoque a custo (admin).
  perform pg_temp.check('margem do mês pelo custo atual (X: 3×400 + 1×1500; Y: 2×400)',
    2700 + case when y_in_month then 800 else 0 end,
    (after->>'monthMargin')::numeric - (before->>'monthMargin')::numeric);
  perform pg_temp.check('estoque a custo (95×600 + 98×1000)',
    155000::numeric, (after->>'stockValue')::numeric - (before->>'stockValue')::numeric);

  -- Perfis.
  perform pg_temp.check('operador vê as mesmas vendas do mês', after->>'monthSales', as_op->>'monthSales');
  perform pg_temp.check('operador não recebe a margem', 'null', coalesce(as_op->>'monthMargin', 'null'));
  perform pg_temp.check('operador não recebe o estoque a custo', 'null', coalesce(as_op->>'stockValue', 'null'));
  perform pg_temp.check('usuário inativo vê zero vendas', '0', pg_temp.dash(inativo)->>'monthSales');
  perform pg_temp.check('anon não chama a função', true, pg_temp.dash(null) is null);

  -- Estoque baixo.
  update public.products set min_stock = 95 where sku = 'DASH-001';
  perform pg_temp.check('produto no mínimo conta como estoque baixo', 1,
    (pg_temp.dash(admin)->>'lowStockProducts')::int - (before->>'lowStockProducts')::int);
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
    raise exception E'DASHBOARD FALHOU:\n%', failures;
  end if;
  raise notice 'DASHBOARD OK: % verificações', total;
end;
$$;

select label, expected, actual, passed from rls_results;

rollback;
