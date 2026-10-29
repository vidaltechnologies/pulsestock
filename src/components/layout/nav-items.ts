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

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  // Módulos das próximas etapas aparecem no menu, mas ainda sem link.
  available: boolean;
  // Quando definido, o item só aparece para esse perfil.
  role?: AppRole;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, available: true },
  { href: "/produtos", label: "Produtos", icon: Package, available: true },
  { href: "/estoque", label: "Estoque", icon: Boxes, available: true },
  { href: "/clientes", label: "Clientes", icon: Users, available: true },
  { href: "/pedidos", label: "Pedidos", icon: ClipboardList, available: true },
  { href: "/usuarios", label: "Usuários", icon: ShieldCheck, available: true, role: "admin" },
];

export function navItemsFor(role: AppRole | null) {
  return NAV_ITEMS.filter((item) => !item.role || item.role === role);
}
