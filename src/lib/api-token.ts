import "server-only";

import type { Session } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { apiError } from "@/lib/api";
import { createStatelessClient } from "@/lib/supabase/stateless";

// Resposta das rotas de token: o par de tokens do Supabase Auth e o perfil.
// Usuário desativado não recebe token, e a sessão aberta agora é encerrada.
export async function tokenResponse(session: Session) {
  const supabase = createStatelessClient(session.access_token);
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, active")
    .eq("id", session.user.id)
    .maybeSingle();

  if (!profile?.active) {
    await supabase.auth.admin.signOut(session.access_token, "local");
    return apiError(
      403,
      "user_inactive",
      "Seu acesso está desativado. Fale com um administrador.",
    );
  }

  return NextResponse.json(
    {
      data: {
        tokenType: "Bearer",
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        expiresIn: session.expires_in,
        expiresAt: session.expires_at,
        user: {
          id: session.user.id,
          email: session.user.email ?? "",
          fullName: profile.full_name,
          role: profile.role,
        },
      },
    },
    // Token não pode ficar em cache de navegador nem de proxy.
    { headers: { "Cache-Control": "no-store" } },
  );
}
