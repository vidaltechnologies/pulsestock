import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

// Encerra a sessão e volta ao login. Usado quando o usuário foi desativado
// com a sessão aberta (?motivo=desativado), para o login mostrar o aviso.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const loginUrl = new URL("/login", request.url);
  if (request.nextUrl.searchParams.get("motivo") === "desativado") {
    loginUrl.searchParams.set("motivo", "desativado");
  }
  return NextResponse.redirect(loginUrl);
}
