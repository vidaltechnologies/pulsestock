import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";

import { toDataError, type DataError, type DataResult } from "@/lib/data/products";
import { getDisplayNames } from "@/lib/data/users";
import { createClient } from "@/lib/supabase/server";
import {
  type ORDER_SORT_FIELDS,
  type OrderInput,
  type OrderListQuery,
  type OrderStatus,
} from "@/lib/validations/order";
import { parseSort } from "@/lib/validations/sort";

// Pedidos de venda. Gravação e troca de status passam pelas funções
// save_order e change_order_status do banco, que fazem tudo numa transação.

export type OrderSummary = {
  id: string;
  number: number;
  status: OrderStatus;
  totalAmount: number;
  createdAt: string;
  confirmedAt: string | null;
  customer: { id: string; name: string };
};

export type OrderItem = {
  id: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  product: { id: string; sku: string; name: string; unit: string; stockQuantity: number };
};

export type Order = OrderSummary & {
  notes: string | null;
  updatedAt: string;
  customer: {
    id: string;
    name: string;
    document: string | null;
    email: string | null;
    phone: string | null;
  };
  createdBy: { id: string; name: string | null };
  items: OrderItem[];
};

const NOT_FOUND: DataError = { status: 404, code: "not_found", message: "Pedido não encontrado." };

// Erros de regra de negócio vêm do banco com um código em `hint`.
const HINT_STATUS: Record<string, number> = {
  empty_order: 400,
  invalid_customer: 400,
  invalid_product: 400,
  inactive_product: 409,
  not_editable: 409,
  invalid_transition: 409,
  insufficient_stock: 409,
  not_found: 404,
};

function orderError(error: PostgrestError): DataError {
  const status = error.hint ? HINT_STATUS[error.hint] : undefined;
  if (status) {
    return { status, code: error.hint!, message: error.message };
  }
  if (error.code === "42501") {
    return { status: 403, code: "forbidden", message: error.message || "Seu perfil não tem permissão para esta ação." };
  }
  return toDataError(error, "");
}

// Só dígitos (com ou sem #) = número do pedido; o resto busca no nome do cliente.
function parseSearch(q: string) {
  const number = q.replace(/^#/, "");
  if (/^\d{1,15}$/.test(number)) {
    return { number: Number(number) };
  }
  const name = q.replace(/[%_,()*\\:"'.]/g, " ").trim();
  return name ? { name } : {};
}

type SummaryRow = {
  id: string;
  number: number;
  status: OrderStatus;
  total_amount: number;
  created_at: string;
  confirmed_at: string | null;
  customer: { id: string; name: string } | null;
};

function toSummary(row: SummaryRow): OrderSummary {
  return {
    id: row.id,
    number: row.number,
    status: row.status,
    totalAmount: Number(row.total_amount),
    createdAt: row.created_at,
    confirmedAt: row.confirmed_at,
    customer: row.customer ?? { id: "", name: "Cliente removido" },
  };
}

const ORDER_SORT_COLUMNS = {
  number: "number",
  createdAt: "created_at",
  totalAmount: "total_amount",
} as const satisfies Record<(typeof ORDER_SORT_FIELDS)[number], string>;

export async function listOrders(
  query: OrderListQuery,
): Promise<DataResult<{ items: OrderSummary[]; total: number }>> {
  const supabase = await createClient();
  const from = (query.page - 1) * query.pageSize;
  const search = parseSearch(query.q);
  const sort = parseSort(query.sort);

  // !inner faz o filtro pelo nome do cliente valer para o pedido.
  const customerEmbed = search.name ? "customer:customers!inner(id, name)" : "customer:customers(id, name)";

  let request = supabase
    .from("orders")
    .select(`id, number, status, total_amount, created_at, confirmed_at, ${customerEmbed}`, {
      count: "exact",
    })
    .order(ORDER_SORT_COLUMNS[sort.field], { ascending: sort.ascending })
    .order("id")
    .range(from, from + query.pageSize - 1);

  if (search.number !== undefined) {
    request = request.eq("number", search.number);
  }
  if (search.name) {
    request = request.ilike("customer.name", `%${search.name}%`);
  }
  if (query.status) {
    request = request.eq("status", query.status);
  }
  if (query.customerId) {
    request = request.eq("customer_id", query.customerId);
  }

  const { data, error, count } = await request;
  if (error) {
    if (error.code === "PGRST103") {
      return { data: { items: [], total: count ?? 0 } };
    }
    return { error: toDataError(error, "") };
  }
  return { data: { items: (data as SummaryRow[]).map(toSummary), total: count ?? 0 } };
}

const ORDER_COLUMNS = `id, number, status, total_amount, notes, created_at, updated_at, confirmed_at, created_by,
  customer:customers(id, name, document, email, phone),
  items:order_items(id, quantity, unit_price, subtotal, product:products(id, sku, name, unit, stock_quantity))`;

export async function getOrder(id: string): Promise<DataResult<Order>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("orders").select(ORDER_COLUMNS).eq("id", id).maybeSingle();

  if (error) {
    return { error: toDataError(error, "") };
  }
  if (!data) {
    return { error: NOT_FOUND };
  }

  const names = await getDisplayNames([data.created_by]);
  return {
    data: {
      id: data.id,
      number: data.number,
      status: data.status,
      totalAmount: Number(data.total_amount),
      notes: data.notes,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      confirmedAt: data.confirmed_at,
      customer: data.customer ?? { id: "", name: "Cliente removido", document: null, email: null, phone: null },
      createdBy: { id: data.created_by, name: names.get(data.created_by) ?? null },
      items: data.items
        .map((item) => ({
          id: item.id,
          quantity: item.quantity,
          unitPrice: Number(item.unit_price),
          subtotal: Number(item.subtotal ?? item.quantity * Number(item.unit_price)),
          product: item.product
            ? {
                id: item.product.id,
                sku: item.product.sku,
                name: item.product.name,
                unit: item.product.unit,
                stockQuantity: item.product.stock_quantity,
              }
            : { id: "", sku: "", name: "Produto removido", unit: "", stockQuantity: 0 },
        }))
        .sort((a, b) => a.product.name.localeCompare(b.product.name, "pt-BR")),
    },
  };
}

// Cria (sem orderId) ou substitui cliente, observações e itens de um pedido
// pendente. Devolve o pedido gravado.
export async function saveOrder(input: OrderInput, orderId?: string): Promise<DataResult<Order>> {
  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("save_order", {
    p_customer_id: input.customerId,
    p_items: input.items.map((item) => ({ product_id: item.productId, quantity: item.quantity })),
    p_notes: input.notes ?? undefined,
    p_order_id: orderId,
  });

  if (error) {
    return { error: orderError(error) };
  }
  return getOrder(id);
}

export async function changeOrderStatus(id: string, status: OrderStatus): Promise<DataResult<Order>> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("change_order_status", { p_order_id: id, p_status: status });

  if (error) {
    return { error: orderError(error) };
  }
  return getOrder(id);
}
