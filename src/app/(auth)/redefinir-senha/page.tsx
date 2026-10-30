import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Button } from "@/components/ui/button";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.meta.resetPassword };
}

// Chega aqui pelo link do e-mail, já com a sessão criada em /auth/confirm.
// Sem sessão, o link venceu ou já foi usado.
export default async function ResetPasswordPage() {
  const { t } = await getI18n();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims?.sub) {
    return (
      <AuthShell title={t.resetPassword.title} description={t.resetPassword.expired}>
        <Button asChild className="w-full">
          <Link href="/esqueci-senha">{t.resetPassword.requestNew}</Link>
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t.resetPassword.title} description={t.resetPassword.description}>
      <ResetPasswordForm />
    </AuthShell>
  );
}
