import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { createClient, getBearerToken } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type AppRole = Database["public"]["Enums"]["app_role"];

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string;
  role: AppRole;
};

// Sessão e perfil do usuário. Memorizado por requisição com cache() do
// React para não repetir a consulta em vários componentes da mesma página.
// `signedIn` sem `user` = tem sessão, mas o perfil está desativado.
const getSession = cache(async (): Promise<{ signedIn: boolean; user: CurrentUser | null }> => {
  const supabase = await createClient();

  // Com token no cabeçalho, getClaims valida esse token; sem ele, o da sessão.
  const { data: claimsData } = await supabase.auth.getClaims(await getBearerToken());
  const claims = claimsData?.claims;
  if (!claims?.sub) {
    return { signedIn: false, user: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, active")
    .eq("id", claims.sub)
    .maybeSingle();

  if (!profile?.active) {
    return { signedIn: true, user: null };
  }

  return {
    signedIn: true,
    user: {
      id: claims.sub,
      email: claims.email ?? "",
      fullName: profile.full_name,
      role: profile.role,
    },
  };
});

// Usuário logado e ativo, ou null.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  return (await getSession()).user;
}

// Para páginas da área logada: manda para o login quem não tem acesso. Quem
// foi desativado com a sessão aberta passa por /sair, que encerra a sessão;
// senão o proxy o mandaria do login de volta para o dashboard.
export async function requireUser() {
  const { signedIn, user } = await getSession();
  if (!user) {
    redirect(signedIn ? "/sair?motivo=desativado" : "/login");
  }
  return user;
}

// Para páginas restritas a um perfil: quem não tem o perfil volta ao dashboard.
export async function requireRole(role: AppRole) {
  const user = await requireUser();
  if (user.role !== role) {
    redirect("/dashboard");
  }
  return user;
}
