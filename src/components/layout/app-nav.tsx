"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

import { NAV_ITEMS } from "./nav-items";

export function AppNav({ orientation }: { orientation: "vertical" | "horizontal" }) {
  const pathname = usePathname();
  const vertical = orientation === "vertical";

  return (
    <nav aria-label="Menu principal">
      <ul className={cn("flex gap-1", vertical ? "flex-col" : "overflow-x-auto")}>
        {NAV_ITEMS.map(({ href, label, icon: Icon, available }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          const itemClass = cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap",
            active
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-muted-foreground",
          );

          return (
            <li key={href}>
              {available ? (
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(itemClass, "transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground")}
                >
                  <Icon className="size-4" aria-hidden />
                  {label}
                </Link>
              ) : (
                <span className={cn(itemClass, "cursor-not-allowed opacity-60")} aria-disabled>
                  <Icon className="size-4" aria-hidden />
                  {label}
                  {vertical && (
                    <span className="ml-auto text-xs font-normal">em breve</span>
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
