import { NextResponse } from "next/server";

import { apiError, parseJsonBody } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { resetPasswordSchema } from "@/lib/validations/auth";

// Grava a nova senha de quem abriu o link de recuperação (a sessão vem de
// /auth/confirm) e encerra a sessão, para a pessoa entrar com a senha nova.
export async function POST(request: Request) {
  const { data, error } = await parseJsonBody(request, resetPasswordSchema);
  if (error) {
    return error;
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) {
    return apiError(
      401,
      "recovery_expired",
      "Seu link de recuperação venceu ou já foi usado. Peça um novo.",
    );
  }

  const { error: authError } = await supabase.auth.updateUser({ password: data.password });

  if (authError?.code === "same_password") {
    return apiError(422, "same_password", "A nova senha precisa ser diferente da atual.");
  }
  if (authError?.code === "weak_password") {
    return apiError(422, "weak_password", "Essa senha é fraca demais. Escolha outra.");
  }
  if (authError) {
    console.error("Falha ao trocar a senha:", authError.code, authError.message);
    return apiError(500, "unexpected", "Erro inesperado. Tente de novo.");
  }

  await supabase.auth.signOut();
  return new NextResponse(null, { status: 204 });
}
