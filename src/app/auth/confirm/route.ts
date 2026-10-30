import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

// Destino do link do e-mail de recuperação de senha:
// /auth/confirm?token_hash=...&type=recovery. Troca o token por uma sessão
// e segue para a tela de nova senha. Funciona em qualquer navegador, não só
// no que pediu o link.
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");

  if (tokenHash && type === "recovery") {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) {
      return NextResponse.redirect(new URL("/redefinir-senha", request.url));
    }
  }

  const forgotUrl = new URL("/esqueci-senha", request.url);
  forgotUrl.searchParams.set("motivo", "link-invalido");
  return NextResponse.redirect(forgotUrl);
}
