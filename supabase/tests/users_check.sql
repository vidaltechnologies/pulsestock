-- Verificação da administração de usuários: lista com e-mail só para o
-- admin, alteração de perfil e status, trava contra mudar a si mesmo e
-- efeito da desativação.
--
-- Como os outros scripts, roda numa transação e desfaz tudo no final.
--
-- Uso:
--   npx supabase db query --linked -f supabase/tests/users_check.sql
--
-- Termina com "USUÁRIOS OK: N verificações" ou com um erro listando as falhas.

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
  ('a0000000-0000-4000-8000-000000000001', 'usr-admin@teste.local', '{"full_name":"Admin Usuários"}'),
  ('a0000000-0000-4000-8000-000000000002', 'usr-operador@teste.local', '{"full_name":"Operador Usuários"}'),
  ('a0000000-0000-4000-8000-000000000003', 'usr-outro@teste.local', '{"full_name":"Outro Usuário"}');

update public.profiles set role = 'admin' where id = 'a0000000-0000-4000-8000-000000000001';

-- ---------------------------------------------------------------------------
-- Verificações
-- ---------------------------------------------------------------------------

do $$
declare
  admin uuid := 'a0000000-0000-4000-8000-000000000001';
  op uuid := 'a0000000-0000-4000-8000-000000000002';
  outro uuid := 'a0000000-0000-4000-8000-000000000003';
  lista text := $q$select count(*) from public.list_users() where email like 'usr-%@teste.local'$q$;
begin
  -- Lista
  perform pg_temp.expect('admin lista os usuários com e-mail', admin, lista, 'rows=3');
  perform pg_temp.expect('lista traz o perfil de cada um', admin,
    $q$select count(*) from public.list_users() where email = 'usr-admin@teste.local' and role = 'admin' and active$q$, 'rows=1');
  perform pg_temp.expect('operador não lista usuários', op, lista, 'denied');
  perform pg_temp.expect('anon não lista usuários', null, lista, 'denied');
  perform pg_temp.expect('operador não lê o perfil dos outros', op,
    format('select count(*) from public.profiles where id = %L', outro), 'rows=0');

  -- Alterações pelo admin
  perform pg_temp.expect('admin promove outro usuário a admin', admin,
    format('update public.profiles set role = %L where id = %L', 'admin', outro), 'ok');
  perform pg_temp.expect('admin devolve o usuário a operador', admin,
    format('update public.profiles set role = %L where id = %L', 'operator', outro), 'ok');
  perform pg_temp.expect('admin muda o nome de outro usuário', admin,
    format('update public.profiles set full_name = %L where id = %L', 'Nome Novo', outro), 'ok');
  perform pg_temp.expect('admin muda o próprio nome', admin,
    format('update public.profiles set full_name = %L where id = %L', 'Admin Renomeado', admin), 'ok');

  -- Trava contra mudar a si mesmo
  perform pg_temp.expect('admin não rebaixa a si mesmo', admin,
    format('update public.profiles set role = %L where id = %L', 'operator', admin), 'denied');
  perform pg_temp.expect('admin não desativa a si mesmo', admin,
    format('update public.profiles set active = false where id = %L', admin), 'denied');
  perform pg_temp.expect('admin continua admin e ativo', admin,
    format('select count(*) from public.profiles where id = %L and role = %L and active', admin, 'admin'), 'rows=1');

  -- Operador não altera ninguém
  perform pg_temp.expect('operador não se promove', op,
    format('update public.profiles set role = %L where id = %L', 'admin', op), 'denied');
  perform pg_temp.expect('operador não desativa outro usuário', op,
    format('update public.profiles set active = false where id = %L', outro), 'denied');
  perform pg_temp.expect('operador não insere perfil', op,
    format('insert into public.profiles (id) values (%L)', gen_random_uuid()), 'denied');

  -- Desativação
  perform pg_temp.expect('admin desativa o operador', admin,
    format('update public.profiles set active = false where id = %L', op), 'ok');
  perform pg_temp.expect('operador desativado não lê produtos', op,
    'select count(*) from public.products', 'rows=0');
  perform pg_temp.expect('operador desativado não lê o próprio perfil ativo', op,
    format('select count(*) from public.profiles where id = %L and active', op), 'rows=0');
  perform pg_temp.expect('operador desativado não cadastra cliente', op,
    $q$insert into public.customers (name) values ('Cliente de inativo')$q$, 'denied');
  perform pg_temp.expect('admin reativa o operador', admin,
    format('update public.profiles set active = true where id = %L', op), 'ok');
  perform pg_temp.expect('operador reativado volta a cadastrar cliente', op,
    $q$insert into public.customers (name) values ('Cliente de reativado')$q$, 'ok');

end;
$$;

-- Fora da API: como superusuário, sem auth.uid(), o próprio admin pode ser alterado.
update public.profiles set active = false where id = 'a0000000-0000-4000-8000-000000000001';
insert into rls_results
  select 'painel do Supabase altera qualquer perfil', 'ok',
    case when active then 'denied' else 'ok' end, not active
  from public.profiles where id = 'a0000000-0000-4000-8000-000000000001';

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
    raise exception E'USUÁRIOS FALHOU:\n%', failures;
  end if;
  raise notice 'USUÁRIOS OK: % verificações', total;
end;
$$;

select label, expected, actual, passed from rls_results;

rollback;
