import { NextResponse } from "next/server";

import { apiError, created, parseJsonBody } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { createCategory, listCategories } from "@/lib/data/products";
import { categorySchema } from "@/lib/validations/product";

export async function GET() {
  const { error: authError } = await requireApiUser();
  if (authError) {
    return authError;
  }

  const { data, error } = await listCategories();
  if (error) {
    return apiError(error.status, error.code, error.message);
  }
  return NextResponse.json({ data });
}

// Nova categoria (administrador). Nome repetido, sem diferenciar maiúsculas,
// retorna 409.
export async function POST(request: Request) {
  const { error: authError } = await requireApiUser("admin");
  if (authError) {
    return authError;
  }

  const body = await parseJsonBody(request, categorySchema);
  if (body.error) {
    return body.error;
  }

  const { data, error } = await createCategory(body.data);
  if (error) {
    return apiError(error.status, error.code, error.message);
  }
  return created(data, `/api/v1/categories/${data.id}`);
}
