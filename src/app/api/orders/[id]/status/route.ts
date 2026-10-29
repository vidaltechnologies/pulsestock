import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, parseJsonBody } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { changeOrderStatus } from "@/lib/data/orders";
import { orderStatusChangeSchema } from "@/lib/validations/order";

// Muda o status: { "status": "confirmed" | "shipped" | "delivered" | "cancelled" }.
// Confirmar baixa o estoque (409 se faltar saldo, sem baixar nada);
// cancelar é só do admin e devolve o estoque de pedido já confirmado.
export async function POST(request: Request, ctx: RouteContext<"/api/orders/[id]/status">) {
  const { user, error: authError } = await requireApiUser();
  if (authError) {
    return authError;
  }

  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) {
    return apiError(404, "not_found", "Pedido não encontrado.");
  }

  const body = await parseJsonBody(request, orderStatusChangeSchema);
  if (body.error) {
    return body.error;
  }

  if (body.data.status === "cancelled" && user.role !== "admin") {
    return apiError(403, "forbidden", "Só administradores cancelam pedidos.");
  }

  const { data, error } = await changeOrderStatus(id, body.data.status);
  if (error) {
    return apiError(error.status, error.code, error.message);
  }
  return NextResponse.json({ data });
}
