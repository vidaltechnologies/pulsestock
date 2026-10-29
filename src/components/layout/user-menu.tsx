import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";

import { LogoutButton } from "./logout-button";

export async function UserMenu() {
  const [user, { t }] = await Promise.all([requireUser(), getI18n()]);

  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right sm:block">
        <p className="text-sm leading-tight font-medium">{user.fullName || user.email}</p>
        <p className="text-xs leading-tight text-muted-foreground">{user.email}</p>
      </div>
      <Badge variant={user.role === "admin" ? "default" : "secondary"}>
        {t.roles[user.role]}
      </Badge>
      <LogoutButton />
    </div>
  );
}
