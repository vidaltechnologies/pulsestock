import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type AppRole = Database["public"]["Enums"]["app_role"];

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string;
  role: AppRole;
};

// Usuário logado e ativo, ou null. Memorizado por requisição com cache() do
// React para não repetir a consulta em vários componentes da mesma página.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims?.sub) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, active")
    .eq("id", claims.sub)
    .maybeSingle();

  if (!profile?.active) {
    return null;
  }

  return {
    id: claims.sub,
    email: claims.email ?? "",
    fullName: profile.full_name,
    role: profile.role,
  };
});

// Para páginas da área logada: manda para o login quem não tem acesso.
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrador",
  operator: "Operador",
};
