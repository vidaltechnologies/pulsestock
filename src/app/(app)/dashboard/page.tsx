import type { Metadata } from "next";
import { Suspense } from "react";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<Skeleton className="h-9 w-64" />}>
        <Greeting />
      </Suspense>
      <Card>
        <CardHeader>
          <CardTitle>Indicadores em construção</CardTitle>
          <CardDescription>
            Vendas, pedidos por status e alertas de estoque chegam na etapa do dashboard,
            depois dos módulos de produtos, estoque, clientes e pedidos.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

async function Greeting() {
  const user = await requireUser();
  const firstName = (user.fullName || user.email).split(" ")[0];

  return (
    <h1 className="text-2xl font-semibold tracking-tight">Olá, {firstName}</h1>
  );
}
