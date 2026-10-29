import "server-only";

import { createClient } from "@/lib/supabase/server";

// Nomes de usuários para históricos (quem movimentou, quem criou o pedido).
// O operador só lê o próprio perfil, então os nomes vêm de uma função do
// banco que devolve apenas id e nome.
export async function getDisplayNames(ids: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const unique = [...new Set(ids)];
  if (unique.length === 0) {
    return names;
  }

  const supabase = await createClient();
  const { data } = await supabase.rpc("user_display_names", { user_ids: unique });
  data?.forEach((u) => names.set(u.id, u.full_name));
  return names;
}
