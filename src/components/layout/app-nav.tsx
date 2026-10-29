"use client";

import { usePathname } from "next/navigation";

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
  return <NavList orientation={orientation} role={role} pathname={pathname} />;
}
