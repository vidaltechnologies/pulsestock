import { NextResponse } from "next/server";

import { createClient, getBearerToken } from "@/lib/supabase/server";

// Encerra a sessão do cookie ou, com Authorization: Bearer, invalida o
// refreshToken daquele token (o accessToken vale até expirar).
export async function POST() {
  const supabase = await createClient();
  const token = await getBearerToken();
  if (token) {
    await supabase.auth.admin.signOut(token, "local");
  } else {
    await supabase.auth.signOut();
  }
  return NextResponse.json({ ok: true });
}
