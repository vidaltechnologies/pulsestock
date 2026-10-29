import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

import { LoginForm } from "@/components/auth/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Entrar",
};

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 px-4 py-12">
      <div className="flex w-full max-w-sm flex-col items-center gap-8">
        <Link href="/" aria-label="Pulse Stock, página inicial">
          <Image src="/brand/logo-light.svg" alt="Pulse Stock" width={200} height={56} priority />
        </Link>
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-xl">
              <h1>Entrar</h1>
            </CardTitle>
            <CardDescription>
              Use o e-mail e a senha cadastrados pelo administrador.
            </CardDescription>
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
