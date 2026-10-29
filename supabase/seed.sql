-- Pulse Stock: dados de demonstração
--
-- Categorias, produtos, clientes e cerca de 60 dias de pedidos, para o
-- dashboard e as listas terem o que mostrar.
--
-- - Roda sozinho no `supabase db reset` (banco local) e, no projeto na
--   nuvem, com `npm run db:seed`.
-- - Não cria usuários nem senhas. Pedidos e movimentações saem em nome do
--   primeiro administrador ativo; sem administrador, só o catálogo e os
--   clientes são criados.
-- - Pedidos passam pelas mesmas funções do app (save_order e
--   change_order_status), então estoque, totais e histórico ficam coerentes.
-- - Roda uma vez: se já houver produtos com SKU "PS-", não faz nada.

do $$
declare
  admin_id uuid;
  product_ids uuid[];
  customer_ids uuid[];
  v_order uuid;
  v_orders integer := 0;
  day_offset integer;
  orders_today integer;
  item_count integer;
  items jsonb;
  status_target public.order_status;
  v_confirmed timestamptz;
  v_created timestamptz;
  i integer;
  j integer;
  tz constant text := 'America/Sao_Paulo';
begin
  if exists (select 1 from public.products where sku like 'PS-%') then
    raise notice 'Dados de demonstração já existem. Nada foi alterado.';
    return;
  end if;

  perform setseed(0.42);

  -- Catálogo -----------------------------------------------------------------
  insert into public.categories (name) values
    ('Mercearia'), ('Bebidas'), ('Limpeza'), ('Higiene')
    on conflict (lower(name)) do nothing;

  insert into public.products (sku, name, category_id, unit, cost_price, sale_price, min_stock)
  select p.sku, p.name, c.id, p.unit, p.cost, p.sale, p.min
  from (values
    ('PS-ARROZ-5', 'Arroz agulhinha 5 kg', 'Mercearia', 'UN', 19.40, 28.90, 30),
    ('PS-FEIJ-1', 'Feijão carioca 1 kg', 'Mercearia', 'UN', 5.10, 8.99, 40),
    ('PS-CAFE-500', 'Café torrado 500 g', 'Mercearia', 'UN', 11.80, 19.90, 25),
    ('PS-ACU-1', 'Açúcar cristal 1 kg', 'Mercearia', 'UN', 3.20, 5.49, 40),
    ('PS-OLEO-900', 'Óleo de soja 900 ml', 'Mercearia', 'UN', 4.30, 7.49, 30),
    ('PS-MAC-500', 'Macarrão espaguete 500 g', 'Mercearia', 'UN', 2.60, 4.79, 30),
    ('PS-AGUA-15', 'Água mineral 1,5 L', 'Bebidas', 'UN', 1.10, 2.99, 60),
    ('PS-SUCO-1', 'Suco de uva integral 1 L', 'Bebidas', 'UN', 7.90, 13.90, 15),
    ('PS-REFRI-2', 'Refrigerante cola 2 L', 'Bebidas', 'UN', 5.40, 9.49, 30),
    ('PS-LEITE-1', 'Leite integral 1 L', 'Bebidas', 'CX', 3.40, 5.29, 48),
    ('PS-DET-500', 'Detergente neutro 500 ml', 'Limpeza', 'UN', 1.60, 2.89, 40),
    ('PS-SABPO-1', 'Sabão em pó 1 kg', 'Limpeza', 'UN', 9.80, 16.90, 20),
    ('PS-AMAC-2', 'Amaciante 2 L', 'Limpeza', 'UN', 8.20, 14.50, 15),
    ('PS-PAPEL-12', 'Papel higiênico 12 rolos', 'Higiene', 'PCT', 13.50, 21.90, 20),
    ('PS-SAB-90', 'Sabonete 90 g', 'Higiene', 'UN', 1.30, 2.49, 50),
    ('PS-CREME-90', 'Creme dental 90 g', 'Higiene', 'UN', 2.70, 4.99, 40)
  ) as p (sku, name, category, unit, cost, sale, min)
  join public.categories c on lower(c.name) = lower(p.category);

  -- Clientes -----------------------------------------------------------------
  insert into public.customers (name, document, email, phone, city, state) values
    ('Mercado Bom Preço LTDA', '11222333000181', 'compras@bompreco.com.br', '(81) 3222-1010', 'Recife', 'PE'),
    ('Maria Souza', '52998224725', 'maria.souza@email.com', '(81) 99876-5432', 'Olinda', 'PE'),
    ('Padaria Pão Quente', null, 'contato@paoquente.com.br', '(11) 3456-7890', 'São Paulo', 'SP'),
    ('Restaurante Sabor Caseiro', null, 'pedidos@saborcaseiro.com.br', '(21) 2555-0101', 'Rio de Janeiro', 'RJ'),
    ('João Lima', null, 'joao.lima@email.com', '(31) 98765-1234', 'Belo Horizonte', 'MG'),
    ('Lanchonete Esquina', null, null, '(71) 3333-2020', 'Salvador', 'BA'),
    ('Ana Ferreira', null, 'ana.ferreira@email.com', null, 'Curitiba', 'PR'),
    ('Hotel Beira-Mar', null, 'suprimentos@hotelbeiramar.com.br', '(85) 3101-4040', 'Fortaleza', 'CE'),
    ('Escola Pequeno Saber', null, 'adm@pequenosaber.edu.br', '(61) 3232-5050', 'Brasília', 'DF'),
    ('Carlos Mendes', null, null, '(51) 99123-4567', 'Porto Alegre', 'RS')
    on conflict (document) do nothing;

  -- Pedidos (precisam de um autor) -------------------------------------------
  select id into admin_id
    from public.profiles
    where role = 'admin' and active
    order by created_at
    limit 1;

  if admin_id is null then
    raise notice 'Nenhum administrador ativo: criados só catálogo e clientes.';
    return;
  end if;

  -- As funções do app usam auth.uid() para autor e permissões.
  perform set_config('request.jwt.claims',
    json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);

  select array_agg(id order by sku) into product_ids from public.products where sku like 'PS-%';
  select array_agg(id order by name) into customer_ids from public.customers where active;

  -- Estoque inicial, 61 dias atrás.
  insert into public.stock_movements (product_id, type, quantity, reason, created_at)
  select id, 'in', 140 + floor(random() * 100)::int, 'Estoque inicial (demonstração)', now() - interval '61 days'
  from public.products where sku like 'PS-%';

  for day_offset in reverse 59..0 loop
    -- Mais pedidos nos dias úteis.
    orders_today := floor(random() * 3)::int
      + case when extract(isodow from (now() at time zone tz)::date - day_offset) < 6 then 1 else 0 end;
    -- Ontem e hoje sempre têm pedidos, alguns ainda pendentes.
    if day_offset <= 1 then
      orders_today := greatest(orders_today, 2);
    end if;

    for i in 1..orders_today loop
      item_count := 1 + floor(random() * 4)::int;
      items := '[]'::jsonb;
      for j in 1..item_count loop
        items := items || jsonb_build_object(
          'product_id', product_ids[1 + floor(random() * array_length(product_ids, 1))::int],
          'quantity', 1 + floor(random() * 8)::int);
      end loop;

      v_order := public.save_order(
        customer_ids[1 + floor(random() * array_length(customer_ids, 1))::int],
        items,
        case when random() < 0.2 then 'Entregar pela manhã.' end);

      -- Horário do pedido no dia, no fuso de São Paulo (8h às 18h).
      v_created := (((now() at time zone tz)::date - day_offset)
        + make_interval(hours => 8 + floor(random() * 10)::int, mins => floor(random() * 60)::int))
        at time zone tz;
      v_confirmed := least(v_created + make_interval(mins => 20 + floor(random() * 120)::int), now());

      -- Pedidos antigos já foram entregues (alguns cancelados); os recentes
      -- ainda estão no meio do caminho.
      status_target := case
        when random() < 0.06 then 'cancelled'
        when day_offset > 7 then 'delivered'
        when day_offset > 3 then (array['shipped', 'delivered'])[1 + floor(random() * 2)::int]::public.order_status
        when day_offset > 1 then (array['confirmed', 'shipped'])[1 + floor(random() * 2)::int]::public.order_status
        when i = 1 then 'pending'
        else 'confirmed'
      end;

      if status_target <> 'pending' then
        perform public.change_order_status(v_order, 'confirmed');
      end if;
      if status_target in ('shipped', 'delivered') then
        perform public.change_order_status(v_order, 'shipped');
      end if;
      if status_target = 'delivered' then
        perform public.change_order_status(v_order, 'delivered');
      end if;
      if status_target = 'cancelled' then
        perform public.change_order_status(v_order, 'cancelled');
      end if;

      -- Datas do passado (as funções gravam a hora atual).
      update public.orders
        set created_at = v_created,
            confirmed_at = case when confirmed_at is not null then v_confirmed end
        where id = v_order;
      update public.stock_movements
        set created_at = case when type = 'in' then least(v_confirmed + interval '1 day', now()) else v_confirmed end
        where order_id = v_order;
      v_orders := v_orders + 1;
    end loop;
  end loop;

  -- Alguns produtos perto do fim, para o alerta de estoque baixo.
  update public.products
    set min_stock = stock_quantity + 5
    where sku in ('PS-CAFE-500', 'PS-SUCO-1', 'PS-PAPEL-12');

  raise notice 'Dados de demonstração criados: % pedidos.', v_orders;
end;
$$;
