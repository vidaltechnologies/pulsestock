-- Pulse Stock: movimentações de estoque e saldo
--
-- - Cada linha de stock_movements é aplicada ao saldo do produto por um
--   gatilho, na mesma transação. O saldo nunca é gravado direto pela API.
-- - Saída ou ajuste que deixaria o saldo negativo é recusado.
-- - products.low_stock marca produtos com saldo no mínimo ou abaixo dele.
-- - public.user_display_names() devolve só o nome de quem movimentou, sem
--   abrir a leitura de profiles para o operador.

-- ---------------------------------------------------------------------------
-- Saldo
-- ---------------------------------------------------------------------------

-- security definer: o usuário não tem UPDATE em stock_quantity; só esta
-- função altera a coluna. O FOR UPDATE trava o produto, então movimentações
-- simultâneas do mesmo produto são aplicadas uma depois da outra.
create function private.apply_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_quantity integer;
  unit_label text;
  delta integer;
begin
  delta := case new.type
    when 'in' then new.quantity
    when 'out' then -new.quantity
    else new.quantity
  end;

  select stock_quantity, unit
    into current_quantity, unit_label
    from public.products
    where id = new.product_id
    for update;

  if not found then
    raise exception 'Produto não encontrado.' using errcode = '23503';
  end if;

  if current_quantity + delta < 0 then
    raise exception 'Estoque insuficiente: o saldo atual é % %.', current_quantity, unit_label
      using errcode = 'P0001', hint = 'insufficient_stock';
  end if;

  update public.products
    set stock_quantity = current_quantity + delta
    where id = new.product_id;

  return new;
end;
$$;

revoke execute on function private.apply_stock_movement() from public;

create trigger stock_movements_apply
  before insert on public.stock_movements
  for each row execute function private.apply_stock_movement();

-- ---------------------------------------------------------------------------
-- Alerta de estoque mínimo
-- ---------------------------------------------------------------------------

-- Coluna gerada para a API filtrar (o PostgREST não compara duas colunas).
alter table public.products
  add column low_stock boolean not null
  generated always as (min_stock > 0 and stock_quantity <= min_stock) stored;

create index products_low_stock_idx on public.products (low_stock) where active and low_stock;

-- ---------------------------------------------------------------------------
-- Nomes de quem movimentou
-- ---------------------------------------------------------------------------

-- O operador só lê o próprio perfil. Para o histórico mostrar quem fez cada
-- movimentação, esta função devolve id e nome, e nada além disso, para
-- usuários ativos.
create function public.user_display_names(user_ids uuid[])
returns table (id uuid, full_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.full_name
  from public.profiles p
  where p.id = any (user_ids)
    and (select private.is_active_user());
$$;

revoke execute on function public.user_display_names(uuid[]) from public, anon;
grant execute on function public.user_display_names(uuid[]) to authenticated;
