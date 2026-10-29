import { NextResponse } from "next/server";

import { apiError, parseJsonBody } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { createStockMovement, listStockMovements } from "@/lib/data/stock";
import {
  ADMIN_ONLY_TYPES,
  stockMovementListQuerySchema,
  stockMovementSchema,
} from "@/lib/validations/stock";

// Histórico, do mais recente para o mais antigo. Filtros: productId, type
// (in, out, adjustment), page e pageSize.
export async function GET(request: Request) {
  const { error: authError } = await requireApiUser();
  if (authError) {
    return authError;
  }

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const query = stockMovementListQuerySchema.parse(params);
  const { data, error } = await listStockMovements(query);
  if (error) {
    return apiError(error.status, error.code, error.message);
  }

  return NextResponse.json({
    data: data.items,
    pagination: { page: query.page, pageSize: query.pageSize, total: data.total },
  });
}

// Nova movimentação. Entrada: qualquer usuário ativo. Saída e ajuste: admin.
// Saldo insuficiente retorna 409 e nada é gravado.
export async function POST(request: Request) {
  const { user, error: authError } = await requireApiUser();
  if (authError) {
    return authError;
  }

  const body = await parseJsonBody(request, stockMovementSchema);
  if (body.error) {
    return body.error;
  }

  if (ADMIN_ONLY_TYPES.includes(body.data.type) && user.role !== "admin") {
    return apiError(403, "forbidden", "Só administradores registram saídas e ajustes manuais.");
  }

  const { data, error } = await createStockMovement(body.data);
  if (error) {
    return apiError(error.status, error.code, error.message);
  }
  return NextResponse.json({ data }, { status: 201 });
}
