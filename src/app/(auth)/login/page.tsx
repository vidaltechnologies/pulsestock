import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.meta.login };
}

export default async function LoginPage() {
  const { t } = await getI18n();

  return (
    <AuthShell title={t.login.title} description={t.login.description}>
      {/* useSearchParams lê a URL da requisição, então fica atrás de Suspense */}
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
