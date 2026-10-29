import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/api-auth";

// Usuário logado e seu perfil de acesso.
export async function GET() {
  const { user, error } = await requireApiUser();
  if (error) {
    return error;
  }
  return NextResponse.json({ data: user });
}
