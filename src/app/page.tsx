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

import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getI18n } from "@/lib/i18n/server";

const modules = [
  { key: "dashboard", icon: LayoutDashboard },
  { key: "products", icon: Package },
  { key: "stock", icon: Boxes },
  { key: "customers", icon: Users },
  { key: "orders", icon: ClipboardList },
  { key: "roles", icon: ShieldCheck },
] as const;

export default async function Home() {
  const { t } = await getI18n();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-12 px-4 py-16 sm:px-6">
      <header className="flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <Image
            src="/brand/logo-light.svg"
            alt="Pulse Stock"
            width={228}
            height={64}
            priority
          />
          <LanguageSwitcher className="mt-2" />
        </div>
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {t.landing.title}
          </h1>
          <p className="max-w-2xl text-muted-foreground">{t.landing.subtitle}</p>
        </div>
        <Button asChild size="lg" className="self-start">
          <Link href="/login">{t.landing.signIn}</Link>
        </Button>
      </header>

      <section
        aria-label={t.landing.modulesLabel}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {modules.map(({ key, icon: Icon }) => (
          <Card key={key} className="gap-3">
            <CardHeader>
              <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-5" aria-hidden />
              </div>
              <CardTitle>{t.landing.modules[key].title}</CardTitle>
              <CardDescription>{t.landing.modules[key].description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>
    </main>
  );
}
