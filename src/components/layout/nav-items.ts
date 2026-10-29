import {
  Boxes,
  ClipboardList,
  LayoutDashboard,
  Package,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { AppRole } from "@/lib/auth";
import type { Dictionary } from "@/lib/i18n";

export type NavItem = {
  href: string;
  label: keyof Dictionary["nav"];
  icon: LucideIcon;
  // Módulos das próximas etapas aparecem no menu, mas ainda sem link.
  available: boolean;
  // Quando definido, o item só aparece para esse perfil.
  role?: AppRole;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "dashboard", icon: LayoutDashboard, available: true },
  { href: "/produtos", label: "products", icon: Package, available: true },
  { href: "/estoque", label: "stock", icon: Boxes, available: true },
  { href: "/clientes", label: "customers", icon: Users, available: true },
  { href: "/pedidos", label: "orders", icon: ClipboardList, available: true },
  { href: "/usuarios", label: "users", icon: ShieldCheck, available: true, role: "admin" },
];

export function navItemsFor(role: AppRole | null) {
  return NAV_ITEMS.filter((item) => !item.role || item.role === role);
}
