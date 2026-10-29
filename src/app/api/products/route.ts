import { NextResponse } from "next/server";

import { apiError, parseJsonBody } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { createProduct, listProducts } from "@/lib/data/products";
import { productListQuerySchema, productSchema } from "@/lib/validations/product";

// Lista de produtos. Filtros: q (nome ou SKU), categoryId,
// status (active, inactive, all), page e pageSize.
export async function GET(request: Request) {
  const { error: authError } = await requireApiUser();
  if (authError) {
    return authError;
  }

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const query = productListQuerySchema.parse(params);
  const { data, error } = await listProducts(query);
  if (error) {
    return apiError(error.status, error.code, error.message);
  }

  return NextResponse.json({
    data: data.items,
    pagination: { page: query.page, pageSize: query.pageSize, total: data.total },
  });
}

// Cadastro de produto (administrador). O saldo começa em zero e só muda pelas
// movimentações de estoque.
export async function POST(request: Request) {
  const { error: authError } = await requireApiUser("admin");
  if (authError) {
    return authError;
  }

  const body = await parseJsonBody(request, productSchema);
  if (body.error) {
    return body.error;
  }

  const { data, error } = await createProduct(body.data);
  if (error) {
    return apiError(error.status, error.code, error.message);
  }
  return NextResponse.json({ data }, { status: 201 });
}
