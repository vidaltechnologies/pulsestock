import { requireApiUser } from "@/lib/api-auth";

// Rota de teste do Sentry (só administrador): lança um erro de propósito para
// conferir que ele aparece no painel. Fica fora de /api/v1 e da documentação.
export async function GET() {
  const { user, error } = await requireApiUser("admin");
  if (error) {
    return error;
  }

  throw new Error(`Teste do Sentry disparado por um administrador (${user.id}).`);
}
