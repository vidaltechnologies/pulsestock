import "server-only";

import { toDataError, type DataResult } from "@/lib/data/products";
import { createClient } from "@/lib/supabase/server";
import type {
  StockMovementInput,
  StockMovementListQuery,
  StockMovementType,
} from "@/lib/validations/stock";

// Movimentações de estoque. O saldo do produto é atualizado por um gatilho
// no banco a cada movimentação; aqui só se grava e se consulta o histórico.

export type StockMovement = {
  id: string;
  type: StockMovementType;
  quantity: number;
  reason: string | null;
  orderId: string | null;
  createdAt: string;
  product: { id: string; sku: string; name: string; unit: string };
  createdBy: { id: string; name: string | null };
};

const MOVEMENT_COLUMNS =
  "id, type, quantity, reason, order_id, created_at, created_by, product:products(id, sku, name, unit)";

type MovementRow = {
  id: string;
  type: StockMovementType;
  quantity: number;
  reason: string | null;
  order_id: string | null;
  created_at: string;
  created_by: string;
  product: { id: string; sku: string; name: string; unit: string } | null;
};

// O operador só lê o próprio perfil, então os nomes vêm de uma função do
// banco que devolve apenas id e nome.
async function withNames(rows: MovementRow[]): Promise<StockMovement[]> {
  const ids = [...new Set(rows.map((r) => r.created_by))];
  const names = new Map<string, string>();
  if (ids.length > 0) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("user_display_names", { user_ids: ids });
    data?.forEach((u) => names.set(u.id, u.full_name));
  }

  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    quantity: r.quantity,
    reason: r.reason,
    orderId: r.order_id,
    createdAt: r.created_at,
    product: r.product ?? { id: "", sku: "", name: "Produto removido", unit: "" },
    createdBy: { id: r.created_by, name: names.get(r.created_by) ?? null },
  }));
}

export async function listStockMovements(
  query: StockMovementListQuery,
): Promise<DataResult<{ items: StockMovement[]; total: number }>> {
  const supabase = await createClient();
  const from = (query.page - 1) * query.pageSize;

  let request = supabase
    .from("stock_movements")
    .select(MOVEMENT_COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id")
    .range(from, from + query.pageSize - 1);

  if (query.productId) {
    request = request.eq("product_id", query.productId);
  }
  if (query.type) {
    request = request.eq("type", query.type);
  }

  const { data, error, count } = await request;
  if (error) {
    if (error.code === "PGRST103") {
      return { data: { items: [], total: count ?? 0 } };
    }
    return { error: toDataError(error, "") };
  }
  return { data: { items: await withNames(data), total: count ?? 0 } };
}

export async function createStockMovement(
  input: StockMovementInput,
): Promise<DataResult<{ movement: StockMovement; stockQuantity: number }>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_movements")
    .insert({
      product_id: input.productId,
      type: input.type,
      quantity: input.quantity,
      reason: input.reason ?? null,
    })
    .select(MOVEMENT_COLUMNS)
    .single();

  if (error) {
    if (error.hint === "insufficient_stock") {
      return { error: { status: 409, code: "insufficient_stock", message: error.message } };
    }
    if (error.code === "23503") {
      return { error: { status: 400, code: "invalid_reference", message: "Produto não encontrado." } };
    }
    return { error: toDataError(error, "") };
  }

  const { data: product } = await supabase
    .from("products")
    .select("stock_quantity")
    .eq("id", input.productId)
    .single();

  const [movement] = await withNames([data]);
  return { data: { movement, stockQuantity: product?.stock_quantity ?? 0 } };
}
