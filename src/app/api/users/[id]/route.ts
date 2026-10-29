import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, parseJsonBody } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { updateUser } from "@/lib/data/users";
import { userUpdateSchema } from "@/lib/validations/user";

// Edição parcial pelo admin: { fullName?, role?, active? }. Mudar o próprio
// perfil ou status → 409 self_change (o banco também recusa).
export async function PATCH(request: Request, ctx: RouteContext<"/api/users/[id]">) {
  const { user, error: authError } = await requireApiUser("admin");
  if (authError) {
    return authError;
  }

  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) {
    return apiError(404, "not_found", "Usuário não encontrado.");
  }

  const body = await parseJsonBody(request, userUpdateSchema);
  if (body.error) {
    return body.error;
  }

  if (id === user.id && (body.data.role !== undefined || body.data.active !== undefined)) {
    return apiError(
      409,
      "self_change",
      "Você não pode mudar o próprio perfil nem desativar o próprio usuário.",
    );
  }

  const { data, error } = await updateUser(id, body.data);
  if (error) {
    return apiError(error.status, error.code, error.message);
  }
  return NextResponse.json({ data });
}
