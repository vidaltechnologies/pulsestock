import { NextResponse } from "next/server";

import { apiError, parseJsonBody } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { createCustomer, listCustomers } from "@/lib/data/customers";
import { customerListQuerySchema, customerSchema } from "@/lib/validations/customer";

// Lista de clientes. Filtros: q (nome, e-mail ou CPF/CNPJ), status
// (active, inactive, all), page e pageSize.
export async function GET(request: Request) {
  const { error: authError } = await requireApiUser();
  if (authError) {
    return authError;
  }

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const query = customerListQuerySchema.parse(params);
  const { data, error } = await listCustomers(query);
  if (error) {
    return apiError(error.status, error.code, error.message);
  }

  return NextResponse.json({
    data: data.items,
    pagination: { page: query.page, pageSize: query.pageSize, total: data.total },
  });
}

// Cadastro (qualquer usuário ativo). Cliente novo nasce ativo.
export async function POST(request: Request) {
  const { error: authError } = await requireApiUser();
  if (authError) {
    return authError;
  }

  const body = await parseJsonBody(request, customerSchema);
  if (body.error) {
    return body.error;
  }

  const { data, error } = await createCustomer({ ...body.data, active: true });
  if (error) {
    return apiError(error.status, error.code, error.message);
  }
  return NextResponse.json({ data }, { status: 201 });
}
