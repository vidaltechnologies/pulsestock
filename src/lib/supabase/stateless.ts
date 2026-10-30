import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getSupabaseEnv } from "@/lib/env";
import type { Database } from "@/types/database";

// Cliente Supabase sem cookies, para quem chama a API com token
// (Authorization: Bearer). Com o token, as consultas passam pelo RLS do dono
// dele; sem token, serve só para trocar e-mail e senha por um token novo.
export function createStatelessClient(accessToken?: string) {
  const { url, publishableKey } = getSupabaseEnv();

  return createClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined,
  });
}
