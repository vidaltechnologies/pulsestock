import { apiError, parseJsonBody } from "@/lib/api";
import { tokenResponse } from "@/lib/api-token";
import { createStatelessClient } from "@/lib/supabase/stateless";
import { loginSchema } from "@/lib/validations/auth";

// Login para quem chama a API de fora do app: { email, password } →
// { accessToken, refreshToken, ... }. Depois, envie o cabeçalho
// Authorization: Bearer <accessToken>. Não grava cookie.
export async function POST(request: Request) {
  const body = await parseJsonBody(request, loginSchema);
  if (body.error) {
    return body.error;
  }

  const supabase = createStatelessClient();
  const { data, error } = await supabase.auth.signInWithPassword(body.data);
  if (error || !data.session) {
    return apiError(401, "invalid_credentials", "E-mail ou senha incorretos.");
  }

  return tokenResponse(data.session);
}
