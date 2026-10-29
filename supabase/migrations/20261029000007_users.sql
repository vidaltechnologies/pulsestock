-- Pulse Stock: administração de usuários
--
-- - list_users() junta o perfil com o e-mail e o último acesso, que ficam em
--   auth.users (fora do alcance da API). Só o administrador chama.
-- - O administrador não muda o próprio perfil nem desativa a si mesmo. Assim
--   sempre sobra ao menos um administrador ativo para administrar os outros.
--
-- Usuários continuam sendo criados no painel do Supabase (Authentication);
-- o gatilho da etapa 2 cria o perfil como operador.

-- security definer: lê auth.users, que o papel authenticated não acessa.
create function public.list_users()
returns table (
  id uuid,
  email text,
  full_name text,
  role public.app_role,
  active boolean,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Só administradores veem a lista de usuários.' using errcode = '42501';
  end if;

  return query
    select p.id, u.email::text, p.full_name, p.role, p.active, p.created_at, u.last_sign_in_at
    from public.profiles p
    join auth.users u on u.id = p.id
    order by p.active desc, lower(p.full_name), u.email;
end;
$$;

revoke execute on function public.list_users() from public, anon;
grant execute on function public.list_users() to authenticated;

-- Recusa a troca do próprio perfil ou status. Alterações feitas fora da API
-- (painel do Supabase, sem auth.uid()) passam.
create function private.profiles_guard_self()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id = auth.uid() and (new.role <> old.role or new.active <> old.active) then
    raise exception 'Você não pode mudar o próprio perfil nem desativar o próprio usuário.'
      using errcode = 'P0001', hint = 'self_change';
  end if;
  return new;
end;
$$;

revoke execute on function private.profiles_guard_self() from public;

create trigger profiles_guard_self
  before update on public.profiles
  for each row execute function private.profiles_guard_self();
