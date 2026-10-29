import "server-only";

import { toDataError, type DataResult } from "@/lib/data/products";
import { createClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/lib/validations/order";
import type { DashboardPeriod } from "@/lib/validations/dashboard";

// Indicadores do dashboard, calculados no banco por dashboard_summary().
// Venda = pedido confirmado, enviado ou entregue, pela data de confirmação,
// com os dias no fuso de São Paulo.

export type Dashboard = {
  today: string;
  monthStart: string;
  periodStart: string;
  monthSales: number;
  monthOrders: number;
  averageTicket: number;
  pendingOrders: number;
  lowStockProducts: number;
  salesByDay: { day: string; total: number; orders: number }[];
  topProducts: {
    id: string;
    name: string;
    sku: string;
    unit: string;
    quantity: number;
    total: number;
  }[];
  ordersByStatus: Partial<Record<OrderStatus, number>>;
  // Só para o administrador (null para o operador).
  monthMargin: number | null;
  stockValue: number | null;
};

export async function getDashboard(days: DashboardPeriod): Promise<DataResult<Dashboard>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_summary", { p_days: days });

  if (error) {
    return { error: toDataError(error, "") };
  }
  // Os valores numeric chegam como número no JSON; Number() cobre o caso de string.
  const raw = data as unknown as Dashboard;
  const num = (v: unknown) => Number(v ?? 0);
  return {
    data: {
      ...raw,
      monthSales: num(raw.monthSales),
      averageTicket: num(raw.averageTicket),
      salesByDay: raw.salesByDay.map((d) => ({ ...d, total: num(d.total), orders: num(d.orders) })),
      topProducts: raw.topProducts.map((p) => ({
        ...p,
        total: num(p.total),
        quantity: num(p.quantity),
      })),
      monthMargin: raw.monthMargin === null ? null : num(raw.monthMargin),
      stockValue: raw.stockValue === null ? null : num(raw.stockValue),
    },
  };
}
