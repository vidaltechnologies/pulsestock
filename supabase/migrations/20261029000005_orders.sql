-- Pulse Stock: pedidos de venda
--
-- - save_order grava o pedido e seus itens numa transação só, com as
--   permissões do próprio usuário (RLS): cria um pedido novo ou substitui
--   os itens de um pedido pendente.
-- - O preço de cada item é o preço de venda do produto no momento em que o
--   item entra no pedido, e o total do pedido é recalculado por gatilho.
-- - change_order_status é o único caminho para mudar o status. Confirmar
--   baixa o estoque de todos os itens (ou nada, se faltar saldo); cancelar
--   um pedido confirmado devolve o estoque.
--
-- Erros de regra de negócio usam errcode P0001 com um código em `hint`,
-- que a API traduz para o status HTTP.

-- ---------------------------------------------------------------------------
-- Itens: preço do produto e total do pedido
-- ---------------------------------------------------------------------------

-- security definer: lê o produto mesmo que o RLS mude no futuro, e o
-- usuário não grava unit_price diretamente pela API.
create function private.order_items_set_price()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  product record;
begin
  select name, sale_price, active into product
    from public.products
    where id = new.product_id;

  if not found then
    raise exception 'Produto não encontrado.' using errcode = 'P0001', hint = 'invalid_product';
  end if;
  if not product.active then
    raise exception 'O produto "%" está inativo.', product.name
      using errcode = 'P0001', hint = 'inactive_product';
  end if;

  if new.unit_price is null then
    new.unit_price := product.sale_price;
  end if;
  return new;
end;
$$;

revoke execute on function private.order_items_set_price() from public;

create trigger order_items_set_price
  before insert on public.order_items
  for each row execute function private.order_items_set_price();

-- security definer: total_amount não pode ser gravado pela API.
create function private.refresh_order_total()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid := coalesce(new.order_id, old.order_id);
begin
  update public.orders
    set total_amount = coalesce(
      (select sum(subtotal) from public.order_items where order_id = target), 0)
    where id = target;
  return null;
end;
$$;

revoke execute on function private.refresh_order_total() from public;

create trigger order_items_refresh_total
  after insert or update or delete on public.order_items
  for each row execute function private.refresh_order_total();

-- ---------------------------------------------------------------------------
-- save_order: cria ou edita um pedido pendente com seus itens
-- ---------------------------------------------------------------------------

-- p_items: [{ "product_id": uuid, "quantity": int }, ...]. O mesmo produto
-- repetido tem as quantidades somadas. security invoker: tudo passa pelo
-- RLS de quem chama (só usuários ativos, só pedidos pendentes).
create function public.save_order(
  p_customer_id uuid,
  p_items jsonb,
  p_notes text default null,
  p_order_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order_id uuid := p_order_id;
  customer_active boolean;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'O pedido precisa ter ao menos um item.' using errcode = 'P0001', hint = 'empty_order';
  end if;

  select active into customer_active from public.customers where id = p_customer_id;
  if not coalesce(customer_active, false) then
    raise exception 'Cliente não encontrado ou inativo.' using errcode = 'P0001', hint = 'invalid_customer';
  end if;

  if v_order_id is null then
    insert into public.orders (customer_id, notes)
      values (p_customer_id, p_notes)
      returning id into v_order_id;
  else
    update public.orders
      set customer_id = p_customer_id, notes = p_notes
      where id = v_order_id and status = 'pending';
    if not found then
      raise exception 'Pedido não encontrado ou não está mais pendente.'
        using errcode = 'P0001', hint = 'not_editable';
    end if;
    delete from public.order_items where order_id = v_order_id;
  end if;

  insert into public.order_items (order_id, product_id, quantity)
    select v_order_id, item.product_id, sum(item.quantity)
    from jsonb_to_recordset(p_items) as item (product_id uuid, quantity integer)
    group by item.product_id;

  return v_order_id;
end;
$$;

revoke execute on function public.save_order(uuid, jsonb, text, uuid) from public, anon;
grant execute on function public.save_order(uuid, jsonb, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- change_order_status: fluxo de status com baixa e devolução de estoque
-- ---------------------------------------------------------------------------

-- Fluxo: pending → confirmed → shipped → delivered.
-- Cancelar (só admin): de pending ou confirmed. Se já estava confirmado, o
-- estoque volta. Pedido enviado ou entregue não é mais cancelado.
--
-- security definer: grava status, confirmed_at e movimentações ligadas ao
-- pedido, que a API não grava. Por isso as regras de perfil ficam aqui.
create function public.change_order_status(p_order_id uuid, p_status public.order_status)
returns public.order_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status public.order_status;
  item_count integer;
  inactive_name text;
  shortage record;
begin
  if not private.is_active_user() then
    raise exception 'Usuário sem acesso.' using errcode = '42501';
  end if;
  if p_status = 'cancelled' and not private.is_admin() then
    raise exception 'Só administradores cancelam pedidos.' using errcode = '42501';
  end if;

  select status into current_status
    from public.orders
    where id = p_order_id
    for update;

  if not found then
    raise exception 'Pedido não encontrado.' using errcode = 'P0001', hint = 'not_found';
  end if;

  if not (
    (current_status = 'pending' and p_status in ('confirmed', 'cancelled'))
    or (current_status = 'confirmed' and p_status in ('shipped', 'cancelled'))
    or (current_status = 'shipped' and p_status = 'delivered')
  ) then
    raise exception 'Não é possível mudar o pedido de "%" para "%".', current_status, p_status
      using errcode = 'P0001', hint = 'invalid_transition';
  end if;

  if p_status = 'confirmed' then
    select count(*) into item_count from public.order_items where order_id = p_order_id;
    if item_count = 0 then
      raise exception 'O pedido precisa ter ao menos um item.' using errcode = 'P0001', hint = 'empty_order';
    end if;

    -- Trava os produtos em ordem fixa (evita deadlock entre pedidos) e
    -- confere o saldo de todos antes de baixar qualquer um.
    perform 1
      from public.products
      where id in (select product_id from public.order_items where order_id = p_order_id)
      order by id
      for update;

    select p.name into inactive_name
      from public.order_items i
      join public.products p on p.id = i.product_id
      where i.order_id = p_order_id and not p.active
      order by p.name
      limit 1;

    if inactive_name is not null then
      raise exception 'O produto "%" está inativo. Tire-o do pedido antes de confirmar.', inactive_name
        using errcode = 'P0001', hint = 'inactive_product';
    end if;

    select p.name, p.stock_quantity, p.unit, i.quantity into shortage
      from public.order_items i
      join public.products p on p.id = i.product_id
      where i.order_id = p_order_id and i.quantity > p.stock_quantity
      order by p.name
      limit 1;

    if found then
      raise exception 'Estoque insuficiente para "%": o pedido tem % e o saldo é % %.',
        shortage.name, shortage.quantity, shortage.stock_quantity, shortage.unit
        using errcode = 'P0001', hint = 'insufficient_stock';
    end if;

    insert into public.stock_movements (product_id, type, quantity, reason, order_id)
      select i.product_id, 'out', i.quantity, 'Pedido confirmado', p_order_id
      from public.order_items i
      where i.order_id = p_order_id;

    update public.orders
      set status = 'confirmed', confirmed_at = now()
      where id = p_order_id;

  elsif p_status = 'cancelled' and current_status = 'confirmed' then
    insert into public.stock_movements (product_id, type, quantity, reason, order_id)
      select i.product_id, 'in', i.quantity, 'Pedido cancelado', p_order_id
      from public.order_items i
      where i.order_id = p_order_id;

    update public.orders set status = 'cancelled' where id = p_order_id;

  else
    update public.orders set status = p_status where id = p_order_id;
  end if;

  return p_status;
end;
$$;

revoke execute on function public.change_order_status(uuid, public.order_status) from public, anon;
grant execute on function public.change_order_status(uuid, public.order_status) to authenticated;
