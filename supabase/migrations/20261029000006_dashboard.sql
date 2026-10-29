-- Pulse Stock: indicadores do dashboard
--
-- Uma função de agregação devolve tudo o que o dashboard mostra numa
-- consulta só, sem trazer pedidos e itens linha a linha para o Next.js.
--
-- - Venda = pedido confirmado, enviado ou entregue, contado pela data de
--   confirmação. Pendentes e cancelados ficam fora dos valores.
-- - Datas são gravadas em UTC e agrupadas por dia no fuso de São Paulo.
-- - Margem e valor do estoque a custo só saem para o administrador. A margem
--   usa o preço de custo atual do produto (o item não guarda o custo da época).

create index orders_confirmed_at_idx on public.orders (confirmed_at) where confirmed_at is not null;

-- security invoker: lê pelo RLS de quem chama (usuário inativo vê zeros).
create function public.dashboard_summary(p_days integer default 30)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  tz constant text := 'America/Sao_Paulo';
  today date := (now() at time zone tz)::date;
  month_start date := date_trunc('month', today)::date;
  period_start date;
  is_admin boolean := private.is_admin();
  result jsonb;
begin
  if p_days is null or p_days not between 1 and 366 then
    raise exception 'Período inválido.' using errcode = 'P0001', hint = 'invalid_period';
  end if;
  period_start := today - (p_days - 1);

  with sold as (
    select o.id, o.total_amount, (o.confirmed_at at time zone tz)::date as day
    from public.orders o
    where o.status in ('confirmed', 'shipped', 'delivered')
      and o.confirmed_at is not null
      and (o.confirmed_at at time zone tz)::date >= least(month_start, period_start)
  ),
  month_sales as (
    select count(*) as orders, coalesce(sum(total_amount), 0) as total
    from sold
    where day >= month_start
  ),
  daily as (
    select d::date as day,
      coalesce(sum(s.total_amount), 0) as total,
      count(s.id) as orders
    from generate_series(period_start, today, interval '1 day') as d
    left join sold s on s.day = d::date
    group by d
    order by d
  ),
  top_products as (
    select p.id, p.name, p.sku, p.unit,
      sum(i.quantity) as quantity,
      sum(i.subtotal) as total
    from sold s
    join public.order_items i on i.order_id = s.id
    join public.products p on p.id = i.product_id
    where s.day >= period_start
    group by p.id
    order by sum(i.subtotal) desc, p.name
    limit 5
  ),
  by_status as (
    select o.status, count(*) as orders
    from public.orders o
    where (o.created_at at time zone tz)::date >= period_start
    group by o.status
  )
  select jsonb_build_object(
    'today', today,
    'monthStart', month_start,
    'periodStart', period_start,
    'monthSales', (select total from month_sales),
    'monthOrders', (select orders from month_sales),
    'averageTicket', (select case when orders > 0 then round(total / orders, 2) else 0 end from month_sales),
    'pendingOrders', (select count(*) from public.orders where status = 'pending'),
    'lowStockProducts', (select count(*) from public.products where active and low_stock),
    'salesByDay', (select coalesce(jsonb_agg(jsonb_build_object('day', day, 'total', total, 'orders', orders) order by day), '[]') from daily),
    'topProducts', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'sku', sku, 'unit', unit, 'quantity', quantity, 'total', total) order by total desc, name), '[]') from top_products),
    'ordersByStatus', (select coalesce(jsonb_object_agg(status, orders), '{}') from by_status),
    'monthMargin', case when is_admin then (
      select coalesce(sum(i.subtotal - i.quantity * p.cost_price), 0)
      from sold s
      join public.order_items i on i.order_id = s.id
      join public.products p on p.id = i.product_id
      where s.day >= month_start
    ) end,
    'stockValue', case when is_admin then (
      select coalesce(sum(stock_quantity * cost_price), 0) from public.products where active
    ) end
  ) into result;

  return result;
end;
$$;

revoke execute on function public.dashboard_summary(integer) from public, anon;
grant execute on function public.dashboard_summary(integer) to authenticated;
