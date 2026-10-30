import "server-only";

import { apiError } from "@/lib/api";
import { getCurrentUser, type AppRole, type CurrentUser } from "@/lib/auth";
import { getBearerToken } from "@/lib/supabase/server";

// Para Route Handlers: devolve o usuário ou a resposta 401/403 pronta. Vale
// para a sessão do app (cookie) e para o token no cabeçalho Authorization.
// O RLS do banco continua sendo a última barreira.
export async function requireApiUser(
  role?: AppRole,
): Promise<{ user: CurrentUser; error?: never } | { user?: never; error: Response }> {
  const user = await getCurrentUser();

  if (!user) {
    // Token recusado ou de usuário desativado.
    if (await getBearerToken()) {
      return { error: await apiError(401, "invalid_token", "Token inválido ou expirado.") };
    }
    return { error: await apiError(401, "unauthorized", "Faça login para continuar.") };
  }

  if (role && user.role !== role) {
    return {
      error: await apiError(403, "forbidden", "Seu perfil não tem permissão para esta ação."),
    };
  }

  return { user };
}
