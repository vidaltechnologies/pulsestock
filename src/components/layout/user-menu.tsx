import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS, requireUser } from "@/lib/auth";

import { LogoutButton } from "./logout-button";

export async function UserMenu() {
  const user = await requireUser();

  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right sm:block">
        <p className="text-sm leading-tight font-medium">{user.fullName || user.email}</p>
        <p className="text-xs leading-tight text-muted-foreground">{user.email}</p>
      </div>
      <Badge variant={user.role === "admin" ? "default" : "secondary"}>
        {ROLE_LABELS[user.role]}
      </Badge>
      <LogoutButton />
    </div>
  );
}
