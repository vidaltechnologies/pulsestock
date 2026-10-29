import "server-only";

import { apiError } from "@/lib/api";
import { getCurrentUser, type AppRole, type CurrentUser } from "@/lib/auth";

// Para Route Handlers: devolve o usuário ou a resposta 401/403 pronta.
// O RLS do banco continua sendo a última barreira.
export async function requireApiUser(
  role?: AppRole,
): Promise<{ user: CurrentUser; error?: never } | { user?: never; error: Response }> {
  const user = await getCurrentUser();

  if (!user) {
    return { error: await apiError(401, "unauthorized", "Faça login para continuar.") };
  }

  if (role && user.role !== role) {
    return {
      error: await apiError(403, "forbidden", "Seu perfil não tem permissão para esta ação."),
    };
  }

  return { user };
}
