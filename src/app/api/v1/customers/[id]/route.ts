import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, parseJsonBody } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { getCustomer, updateCustomer } from "@/lib/data/customers";
import { customerUpdateSchema } from "@/lib/validations/customer";

function notFound() {
  return apiError(404, "not_found", "Cliente não encontrado.");
}

export async function GET(_request: Request, ctx: RouteContext<"/api/v1/customers/[id]">) {
  const { error: authError } = await requireApiUser();
  if (authError) {
    return authError;
  }

  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) {
    return notFound();
  }

  const { data, error } = await getCustomer(id);
  if (error) {
    return apiError(error.status, error.code, error.message);
  }
  return NextResponse.json({ data });
}

// Edição parcial (qualquer usuário ativo). Inativar ou reativar
// ({ "active": false | true }) é só do administrador.
export async function PATCH(request: Request, ctx: RouteContext<"/api/v1/customers/[id]">) {
  const { user, error: authError } = await requireApiUser();
  if (authError) {
    return authError;
  }

  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) {
    return notFound();
  }

  const body = await parseJsonBody(request, customerUpdateSchema);
  if (body.error) {
    return body.error;
  }

  if (body.data.active !== undefined && user.role !== "admin") {
    return apiError(403, "forbidden", "Só administradores inativam ou reativam clientes.");
  }

  const { data, error } = await updateCustomer(id, body.data);
  if (error) {
    return apiError(error.status, error.code, error.message);
  }
  return NextResponse.json({ data });
}
