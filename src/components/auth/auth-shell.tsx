import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getI18n } from "@/lib/i18n/server";

// Moldura das telas de acesso (login, esqueci a senha, nova senha): logo,
// seletor de idioma e um cartão com título e descrição.
export async function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
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
              <h1>{title}</h1>
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </div>
    </main>
  );
}
