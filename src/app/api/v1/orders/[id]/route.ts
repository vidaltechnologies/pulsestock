import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, parseJsonBody } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { getOrder, saveOrder } from "@/lib/data/orders";
import { orderSchema } from "@/lib/validations/order";

function notFound() {
  return apiError(404, "not_found", "Pedido não encontrado.");
}

export async function GET(_request: Request, ctx: RouteContext<"/api/v1/orders/[id]">) {
  const { error: authError } = await requireApiUser();
  if (authError) {
    return authError;
  }

  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) {
    return notFound();
  }

  const { data, error } = await getOrder(id);
  if (error) {
    return apiError(error.status, error.code, error.message);
  }
  return NextResponse.json({ data });
}

// Substitui cliente, observações e itens de um pedido pendente (mesmo corpo
// do POST). Pedido que já saiu de pendente retorna 409.
export async function PATCH(request: Request, ctx: RouteContext<"/api/v1/orders/[id]">) {
  const { error: authError } = await requireApiUser();
  if (authError) {
    return authError;
  }

  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) {
    return notFound();
  }

  const body = await parseJsonBody(request, orderSchema);
  if (body.error) {
    return body.error;
  }

  const { data, error } = await saveOrder(body.data, id);
  if (error) {
    return apiError(error.status, error.code, error.message);
  }
  return NextResponse.json({ data });
}
