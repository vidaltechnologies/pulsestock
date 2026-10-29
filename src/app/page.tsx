import Image from "next/image";
import Link from "next/link";
import {
  Boxes,
  ClipboardList,
  LayoutDashboard,
  Package,
  ShieldCheck,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const modules = [
  {
    icon: LayoutDashboard,
    title: "Dashboard",
    description: "Indicadores de vendas, pedidos e estoque em gráficos.",
  },
  {
    icon: Package,
    title: "Produtos",
    description: "Cadastro, consulta e edição do catálogo.",
  },
  {
    icon: Boxes,
    title: "Estoque",
    description: "Entradas, saídas, ajustes e alerta de estoque mínimo.",
  },
  {
    icon: Users,
    title: "Clientes",
    description: "Cadastro e consulta de clientes com CPF ou CNPJ.",
  },
  {
    icon: ClipboardList,
    title: "Pedidos",
    description: "Pedidos de venda com baixa de estoque na confirmação.",
  },
  {
    icon: ShieldCheck,
    title: "Perfis de acesso",
    description: "Administrador e operador, com regras no banco.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-12 px-4 py-16 sm:px-6">
      <header className="flex flex-col gap-6">
        <Image
          src="/brand/logo-light.svg"
          alt="Pulse Stock"
          width={228}
          height={64}
          priority
        />
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Gestão de estoque e pedidos em um só lugar
          </h1>
          <p className="max-w-2xl text-muted-foreground">
            Mini ERP construído com Next.js, Supabase e shadcn/ui. Os módulos
            abaixo estão em desenvolvimento.
          </p>
        </div>
        <Button asChild size="lg" className="self-start">
          <Link href="/login">Entrar no sistema</Link>
        </Button>
      </header>

      <section
        aria-label="Módulos do sistema"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {modules.map(({ icon: Icon, title, description }) => (
          <Card key={title} className="gap-3">
            <CardHeader>
              <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-5" aria-hidden />
              </div>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>
    </main>
  );
}
