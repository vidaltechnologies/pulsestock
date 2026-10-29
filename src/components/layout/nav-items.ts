import {
  Boxes,
  ClipboardList,
  LayoutDashboard,
  Package,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  // Módulos das próximas etapas aparecem no menu, mas ainda sem link.
  available: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, available: true },
  { href: "/produtos", label: "Produtos", icon: Package, available: false },
  { href: "/estoque", label: "Estoque", icon: Boxes, available: false },
  { href: "/clientes", label: "Clientes", icon: Users, available: false },
  { href: "/pedidos", label: "Pedidos", icon: ClipboardList, available: false },
  { href: "/usuarios", label: "Usuários", icon: ShieldCheck, available: false },
];
