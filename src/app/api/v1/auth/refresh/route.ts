import { apiError, parseJsonBody } from "@/lib/api";
import { tokenResponse } from "@/lib/api-token";
import { createStatelessClient } from "@/lib/supabase/stateless";
import { refreshTokenSchema } from "@/lib/validations/auth-token";

// Troca o refreshToken por um par novo, antes ou depois do accessToken
// expirar. Cada refreshToken vale uma vez.
export async function POST(request: Request) {
  const body = await parseJsonBody(request, refreshTokenSchema);
  if (body.error) {
    return body.error;
  }

  const supabase = createStatelessClient();
  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: body.data.refreshToken,
  });
  if (error || !data.session) {
    return apiError(
      401,
      "invalid_refresh_token",
      "Token de renovação inválido ou expirado. Peça um token novo.",
    );
  }

  return tokenResponse(data.session);
}
