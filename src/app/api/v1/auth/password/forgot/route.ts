import { NextResponse } from "next/server";

import { apiError, parseJsonBody } from "@/lib/api";
import { createStatelessClient } from "@/lib/supabase/stateless";
import { forgotPasswordSchema } from "@/lib/validations/auth";

// Manda o e-mail com o link de recuperação. O link do modelo de e-mail aponta
// para /auth/confirm (veja a referência técnica). A resposta é a mesma com ou
// sem conta para o e-mail, para a rota não revelar quem é usuário.
export async function POST(request: Request) {
  const { data, error } = await parseJsonBody(request, forgotPasswordSchema);
  if (error) {
    return error;
  }

  const supabase = createStatelessClient();
  const { error: authError } = await supabase.auth.resetPasswordForEmail(data.email);

  if (authError?.status === 429) {
    return apiError(
      429,
      "too_many_requests",
      "Muitos pedidos seguidos. Espere alguns minutos e tente de novo.",
    );
  }
  if (authError) {
    console.error("Falha ao enviar o e-mail de recuperação:", authError.code, authError.message);
  }

  return NextResponse.json({ ok: true }, { status: 202 });
}
