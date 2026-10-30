import { NextResponse } from "next/server";

import { apiError } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { listUsers } from "@/lib/data/users";

// Lista de usuários com e-mail, perfil, status e último acesso. Só admin.
export async function GET() {
  const { error: authError } = await requireApiUser("admin");
  if (authError) {
    return authError;
  }

  const { data, error } = await listUsers();
  if (error) {
    return apiError(error.status, error.code, error.message);
  }
  return NextResponse.json({ data });
}
