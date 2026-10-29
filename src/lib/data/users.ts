import "server-only";

import type { AppRole } from "@/lib/auth";
import { toDataError, type DataError, type DataResult } from "@/lib/data/products";
import { createClient } from "@/lib/supabase/server";
import type { UserUpdateInput } from "@/lib/validations/user";

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

export type AppUser = {
  id: string;
  email: string;
  fullName: string;
  role: AppRole;
  active: boolean;
  createdAt: string;
  lastSignInAt: string | null;
};

// Todos os usuários, com e-mail e último acesso. Só o admin consegue: para
// os outros, list_users() recusa com 42501 (403).
export async function listUsers(): Promise<DataResult<AppUser[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_users");
  if (error) {
    return { error: toDataError(error, "") };
  }
  return {
    data: data.map((u) => ({
      id: u.id,
      email: u.email,
      fullName: u.full_name,
      role: u.role,
      active: u.active,
      createdAt: u.created_at,
      lastSignInAt: u.last_sign_in_at ?? null,
    })),
  };
}

const NOT_FOUND: DataError = { status: 404, code: "not_found", message: "Usuário não encontrado." };

export async function updateUser(id: string, input: UserUpdateInput): Promise<DataResult<AppUser>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ full_name: input.fullName, role: input.role, active: input.active })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    // A trava do banco recusa mudar o próprio perfil ou status.
    if (error.hint === "self_change") {
      return { error: { status: 409, code: "self_change", message: error.message } };
    }
    return { error: toDataError(error, "") };
  }
  if (!data) {
    return { error: NOT_FOUND };
  }

  const users = await listUsers();
  if (users.error) {
    return users;
  }
  const user = users.data.find((u) => u.id === id);
  return user ? { data: user } : { error: NOT_FOUND };
}
