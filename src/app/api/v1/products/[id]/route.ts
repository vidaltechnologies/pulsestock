import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, parseJsonBody } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { getProduct, updateProduct } from "@/lib/data/products";
import { productUpdateSchema } from "@/lib/validations/product";

function notFound() {
  return apiError(404, "not_found", "Produto não encontrado.");
}

export async function GET(_request: Request, ctx: RouteContext<"/api/v1/products/[id]">) {
  const { error: authError } = await requireApiUser();
  if (authError) {
    return authError;
  }

  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) {
    return notFound();
  }

  const { data, error } = await getProduct(id);
  if (error) {
    return apiError(error.status, error.code, error.message);
  }
  return NextResponse.json({ data });
}

// Edição parcial (administrador). Inativar = { "active": false }.
export async function PATCH(request: Request, ctx: RouteContext<"/api/v1/products/[id]">) {
  const { error: authError } = await requireApiUser("admin");
  if (authError) {
    return authError;
  }

  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) {
    return notFound();
  }

  const body = await parseJsonBody(request, productUpdateSchema);
  if (body.error) {
    return body.error;
  }

  const { data, error } = await updateProduct(id, body.data);
  if (error) {
    return apiError(error.status, error.code, error.message);
  }
  return NextResponse.json({ data });
}
