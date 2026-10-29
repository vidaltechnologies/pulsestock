import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

import { LoginForm } from "@/components/auth/login-form";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.meta.login };
}

export default async function LoginPage() {
  const { t } = await getI18n();

  return (
    <main className="relative flex flex-1 items-center justify-center bg-muted/40 px-4 py-12">
      <LanguageSwitcher className="absolute top-4 right-4 sm:top-6 sm:right-6" />
      <div className="flex w-full max-w-sm flex-col items-center gap-8">
        <Link href="/" aria-label={t.login.home}>
          <Image src="/brand/logo-light.svg" alt="Pulse Stock" width={200} height={56} priority />
        </Link>
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-xl">
              <h1>{t.login.title}</h1>
            </CardTitle>
            <CardDescription>{t.login.description}</CardDescription>
          </CardHeader>
          <CardContent>
            {/* useSearchParams lê a URL da requisição, então fica atrás de Suspense */}
            <Suspense>
              <LoginForm />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
