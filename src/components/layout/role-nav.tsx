import { getCurrentUser } from "@/lib/auth";

import { AppNav } from "./app-nav";

// Menu com os itens do perfil do usuário. Lê a sessão, então é usado atrás
// de <Suspense>, com o menu sem itens restritos como fallback.
export async function RoleNav({ orientation }: { orientation: "vertical" | "horizontal" }) {
  const user = await getCurrentUser();
  return <AppNav orientation={orientation} role={user?.role ?? null} />;
}
