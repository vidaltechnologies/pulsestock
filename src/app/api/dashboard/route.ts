import { NextResponse } from "next/server";

import { apiError } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { getDashboard } from "@/lib/data/dashboard";
import { dashboardQuerySchema } from "@/lib/validations/dashboard";

// Indicadores e séries dos gráficos. Filtro: days (7, 30 ou 90; padrão 30).
// monthMargin e stockValue vêm null para o operador.
export async function GET(request: Request) {
  const { error: authError } = await requireApiUser();
  if (authError) {
    return authError;
  }

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const query = dashboardQuerySchema.parse(params);
  const { data, error } = await getDashboard(query.days);
  if (error) {
    return apiError(error.status, error.code, error.message);
  }

  return NextResponse.json({ data });
}
