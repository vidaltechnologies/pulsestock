"use client";

import { usePathname } from "next/navigation";

import { useI18n } from "@/components/i18n/i18n-provider";
import type { AppRole } from "@/lib/auth";

import { NavList } from "./nav-list";

// Menu com o item da página atual destacado. Lê a URL, então fica atrás de
// <Suspense> (Cache Components).
export function AppNav({
  orientation,
  role,
}: {
  orientation: "vertical" | "horizontal";
  role: AppRole | null;
}) {
  const pathname = usePathname();
  const { locale } = useI18n();
  return <NavList orientation={orientation} role={role} pathname={pathname} locale={locale} />;
}
