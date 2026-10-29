import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";

import { getSupabaseEnv } from "@/lib/env";
import type { Database } from "@/types/database";

import { SUPABASE_COOKIE_OPTIONS } from "./cookie-options";

// Cliente Supabase com a sessão do usuário da requisição, para Server
// Components e Route Handlers. As consultas passam pelo RLS desse usuário.
export async function createClient() {
  // O cliente lê o relógio para checar a validade do token. connection()
  // deixa claro para o Next.js que isso só roda na requisição, não no
  // pré-render (Cache Components).
  await connection();
  const cookieStore = await cookies();
  const { url, publishableKey } = getSupabaseEnv();

  return createServerClient<Database>(url, publishableKey, {
    cookieOptions: SUPABASE_COOKIE_OPTIONS,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components não podem gravar cookies. O proxy já renova a
          // sessão a cada requisição, então a falha aqui pode ser ignorada.
        }
      },
    },
  });
}
