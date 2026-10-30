import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, parseJsonBody } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { getCategory, updateCategory } from "@/lib/data/products";
import { categorySchema } from "@/lib/validations/product";

function notFound() {
  return apiError(404, "not_found", "Categoria não encontrada.");
}

export async function GET(_request: Request, ctx: RouteContext<"/api/v1/categories/[id]">) {
  const { error: authError } = await requireApiUser();
  if (authError) {
    return authError;
  }

  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) {
    return notFound();
  }

  const { data, error } = await getCategory(id);
  if (error) {
    return apiError(error.status, error.code, error.message);
  }
  return NextResponse.json({ data });
}

// Renomeia (administrador): { "name" }. Nome repetido retorna 409.
export async function PATCH(request: Request, ctx: RouteContext<"/api/v1/categories/[id]">) {
  const { error: authError } = await requireApiUser("admin");
  if (authError) {
    return authError;
  }

  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) {
    return notFound();
  }

  const body = await parseJsonBody(request, categorySchema);
  if (body.error) {
    return body.error;
  }

  const { data, error } = await updateCategory(id, body.data);
  if (error) {
    return apiError(error.status, error.code, error.message);
  }
  return NextResponse.json({ data });
}
