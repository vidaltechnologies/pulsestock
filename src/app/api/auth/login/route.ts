import { NextResponse } from "next/server";

import { apiError, parseJsonBody } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validations/auth";

export async function POST(request: Request) {
  const { data, error } = await parseJsonBody(request, loginSchema);
  if (error) {
    return error;
  }

  const supabase = await createClient();
  const { data: auth, error: authError } =
    await supabase.auth.signInWithPassword(data);

  if (authError || !auth.user) {
    return apiError(401, "invalid_credentials", "E-mail ou senha incorretos.");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("active")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (!profile?.active) {
    await supabase.auth.signOut();
    return apiError(
      403,
      "user_inactive",
      "Seu acesso está desativado. Fale com um administrador.",
    );
  }

  return NextResponse.json({ ok: true });
}
