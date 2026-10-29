-- Verificação das regras de estoque: saldo aplicado pelo gatilho, saldo
-- negativo recusado, alerta de mínimo e nomes no histórico.
--
-- Como rls_check.sql, roda numa transação e desfaz tudo no final.
--
-- Uso:
--   npx supabase db query --linked -f supabase/tests/stock_check.sql
--
-- Termina com "ESTOQUE OK: N verificações" ou com um erro listando as falhas.

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
  ('a0000000-0000-4000-8000-000000000001', 'est-admin@teste.local', '{"full_name":"Admin Estoque"}'),
  ('a0000000-0000-4000-8000-000000000002', 'est-operador@teste.local', '{"full_name":"Operador Estoque"}'),
  ('a0000000-0000-4000-8000-000000000003', 'est-inativo@teste.local', '{"full_name":"Inativo Estoque"}');

update public.profiles set role = 'admin' where id = 'a0000000-0000-4000-8000-000000000001';
update public.profiles set active = false where id = 'a0000000-0000-4000-8000-000000000003';

insert into public.products (id, sku, name, sale_price, min_stock)
  values ('b0000000-0000-4000-8000-000000000001', 'EST-001', 'Produto Estoque', 10, 5);

-- ---------------------------------------------------------------------------
-- Verificações
-- ---------------------------------------------------------------------------

do $$
declare
  admin uuid := 'a0000000-0000-4000-8000-000000000001';
  op uuid := 'a0000000-0000-4000-8000-000000000002';
  inativo uuid := 'a0000000-0000-4000-8000-000000000003';
  saldo text := $q$select stock_quantity from public.products where sku = 'EST-001'$q$;
  baixo text := $q$select count(*) from public.products where sku = 'EST-001' and low_stock$q$;
  mov text := $q$insert into public.stock_movements (product_id, type, quantity, reason) values ('b0000000-0000-4000-8000-000000000001', %L, %s, 'teste')$q$;
begin
  perform pg_temp.expect('produto novo começa com saldo 0', admin, saldo, 'rows=0');
  perform pg_temp.expect('saldo 0 com mínimo 5 está baixo', admin, baixo, 'rows=1');

  perform pg_temp.expect('operador registra entrada de 10', op, format(mov, 'in', 10), 'ok');
  perform pg_temp.expect('entrada soma ao saldo', op, saldo, 'rows=10');
  perform pg_temp.expect('saldo 10 acima do mínimo', op, baixo, 'rows=0');

  perform pg_temp.expect('admin registra saída de 7', admin, format(mov, 'out', 7), 'ok');
  perform pg_temp.expect('saída subtrai do saldo', admin, saldo, 'rows=3');
  perform pg_temp.expect('saldo 3 com mínimo 5 está baixo', admin, baixo, 'rows=1');

  perform pg_temp.expect('saída maior que o saldo é recusada', admin, format(mov, 'out', 4), 'denied');
  perform pg_temp.expect('saldo fica igual após a recusa', admin, saldo, 'rows=3');

  perform pg_temp.expect('ajuste negativo dentro do saldo', admin, format(mov, 'adjustment', -3), 'ok');
  perform pg_temp.expect('ajuste aplica a diferença', admin, saldo, 'rows=0');
  perform pg_temp.expect('ajuste que deixaria saldo negativo é recusado', admin, format(mov, 'adjustment', -1), 'denied');
  perform pg_temp.expect('ajuste positivo', admin, format(mov, 'adjustment', 2), 'ok');
  perform pg_temp.expect('saldo após ajuste positivo', admin, saldo, 'rows=2');

  perform pg_temp.expect('operador não registra saída', op, format(mov, 'out', 1), 'denied');
  perform pg_temp.expect('saldo direto continua bloqueado', admin, $q$update public.products set stock_quantity = 50 where sku = 'EST-001'$q$, 'denied');
  perform pg_temp.expect('histórico tem só as movimentações aceitas', op, $q$select count(*) from public.stock_movements where product_id = 'b0000000-0000-4000-8000-000000000001'$q$, 'rows=4');
  perform pg_temp.expect('movimentação registra quem fez', op, $q$select count(*) from public.stock_movements where created_by = 'a0000000-0000-4000-8000-000000000002'$q$, 'rows=1');

  -- Nomes no histórico
  perform pg_temp.expect('operador vê o nome do admin', op, $q$select count(*) from public.user_display_names(array['a0000000-0000-4000-8000-000000000001']::uuid[]) where full_name = 'Admin Estoque'$q$, 'rows=1');
  perform pg_temp.expect('inativo não vê nomes', inativo, $q$select count(*) from public.user_display_names(array['a0000000-0000-4000-8000-000000000001']::uuid[])$q$, 'rows=0');
  perform pg_temp.expect('anon não chama a função', null, $q$select * from public.user_display_names(array['a0000000-0000-4000-8000-000000000001']::uuid[])$q$, 'denied');
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
    raise exception E'ESTOQUE FALHOU:\n%', failures;
  end if;
  raise notice 'ESTOQUE OK: % verificações', total;
end;
$$;

select label, expected, actual, passed from rls_results;

rollback;
