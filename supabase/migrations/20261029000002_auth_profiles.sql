-- Pulse Stock: perfis ligados ao Supabase Auth
-- Cria o perfil automaticamente quando um usuário é cadastrado e permite que
-- cada usuário leia o próprio perfil. As demais políticas entram na etapa 3.

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    left(
      coalesce(
        nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
        split_part(new.email, '@', 1),
        ''
      ),
      120
    )
  );
  return new;
end;
$$;

-- Só o gatilho chama esta função; ninguém pela API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Usuários criados antes desta migração também ganham perfil.
insert into public.profiles (id, full_name)
select
  u.id,
  left(
    coalesce(
      nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
      split_part(u.email, '@', 1),
      ''
    ),
    120
  )
from auth.users u
on conflict (id) do nothing;

create policy "profiles: usuário lê o próprio perfil"
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()));
