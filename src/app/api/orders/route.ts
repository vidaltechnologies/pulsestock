import { NextResponse } from "next/server";

import { apiError, parseJsonBody } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { listOrders, saveOrder } from "@/lib/data/orders";
import { orderListQuerySchema, orderSchema } from "@/lib/validations/order";

// Lista de pedidos, do mais novo para o mais antigo. Filtros: q (número do
// pedido ou nome do cliente), status, customerId, page e pageSize.
export async function GET(request: Request) {
  const { error: authError } = await requireApiUser();
  if (authError) {
    return authError;
  }

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const query = orderListQuerySchema.parse(params);
  const { data, error } = await listOrders(query);
  if (error) {
    return apiError(error.status, error.code, error.message);
  }

  return NextResponse.json({
    data: data.items,
    pagination: { page: query.page, pageSize: query.pageSize, total: data.total },
  });
}

// Novo pedido com itens: { customerId, notes?, items: [{ productId, quantity }] }.
// O preço de cada item é o preço de venda atual do produto.
export async function POST(request: Request) {
  const { error: authError } = await requireApiUser();
  if (authError) {
    return authError;
  }

  const body = await parseJsonBody(request, orderSchema);
  if (body.error) {
    return body.error;
  }

  const { data, error } = await saveOrder(body.data);
  if (error) {
    return apiError(error.status, error.code, error.message);
  }
  return NextResponse.json({ data }, { status: 201 });
}
