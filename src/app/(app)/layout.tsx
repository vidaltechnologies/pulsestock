import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

import { NavList } from "@/components/layout/nav-list";
import { RoleNav } from "@/components/layout/role-nav";
import { UserMenu } from "@/components/layout/user-menu";
import { Skeleton } from "@/components/ui/skeleton";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-1">
      <aside className="hidden w-60 shrink-0 flex-col gap-6 border-r bg-sidebar px-3 py-5 md:flex">
        <Link href="/dashboard" className="px-3" aria-label="Pulse Stock, dashboard">
          <Image src="/brand/logo-light.svg" alt="Pulse Stock" width={144} height={40} priority />
        </Link>
        <Suspense fallback={<NavList orientation="vertical" role={null} pathname={null} />}>
          <RoleNav orientation="vertical" />
        </Suspense>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-col gap-2 border-b px-4 py-3 sm:px-6">
          <div className="flex h-10 items-center justify-between gap-4">
            <Link href="/dashboard" className="md:hidden" aria-label="Pulse Stock, dashboard">
              <Image src="/brand/symbol.svg" alt="Pulse Stock" width={32} height={32} />
            </Link>
            <div className="ml-auto">
              {/* Lê a sessão, então fica atrás de Suspense (Cache Components) */}
              <Suspense fallback={<Skeleton className="h-8 w-48" />}>
                <UserMenu />
              </Suspense>
            </div>
          </div>
          <div className="md:hidden">
            <Suspense fallback={<NavList orientation="horizontal" role={null} pathname={null} />}>
              <RoleNav orientation="horizontal" />
            </Suspense>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
