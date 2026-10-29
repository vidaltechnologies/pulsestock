import type { Metadata } from "next";
import { Suspense } from "react";

import { UserActions } from "@/components/users/user-actions";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireRole } from "@/lib/auth";
import { listUsers } from "@/lib/data/users";
import type { Dictionary } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.meta.users };
}

export default async function UsersPage() {
  const { t } = await getI18n();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t.meta.users}</h1>
        <p className="text-sm text-muted-foreground">{t.users.subtitle}</p>
      </div>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <UsersTable />
      </Suspense>
    </div>
  );
}

async function UsersTable() {
  const me = await requireRole("admin");
  const [{ data: users, error }, { t, f }] = await Promise.all([listUsers(), getI18n()]);

  if (error) {
    return (
      <p
        role="alert"
        className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
      >
        {t.users.loadError}
      </p>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t.users.user}</TableHead>
            <TableHead className="hidden md:table-cell">{t.common.status}</TableHead>
            <TableHead className="hidden lg:table-cell">{t.users.lastSignIn}</TableHead>
            <TableHead>{t.users.roleAndAccess}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => {
            const name = user.fullName || user.email;
            return (
              <TableRow key={user.id} className={user.active ? undefined : "text-muted-foreground"}>
                <TableCell>
                  <span className="font-medium">{name}</span>
                  <span className="block text-xs text-muted-foreground">{user.email}</span>
                  <span className="mt-1 block md:hidden">
                    <StatusBadge active={user.active} t={t} />
                  </span>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <StatusBadge active={user.active} t={t} />
                </TableCell>
                <TableCell className="hidden tabular-nums lg:table-cell">
                  {user.lastSignInAt ? f.dateTime(user.lastSignInAt) : t.users.neverSignedIn}
                </TableCell>
                <TableCell>
                  {user.id === me.id ? (
                    <span className="text-sm">
                      {t.roles[user.role]}
                      <span className="block text-xs text-muted-foreground">
                        {t.users.selfNote}
                      </span>
                    </span>
                  ) : (
                    <UserActions id={user.id} name={name} role={user.role} active={user.active} />
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function StatusBadge({ active, t }: { active: boolean; t: Dictionary }) {
  return active ? (
    <Badge variant="secondary">{t.common.active}</Badge>
  ) : (
    <Badge variant="outline">{t.users.deactivated}</Badge>
  );
}
