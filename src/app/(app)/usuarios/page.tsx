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
import { ROLE_LABELS, requireRole } from "@/lib/auth";
import { listUsers } from "@/lib/data/users";

export const metadata: Metadata = {
  title: "Usuários",
};

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

export default function UsersPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Usuários</h1>
        <p className="text-sm text-muted-foreground">
          Perfil e acesso de cada pessoa. Novos usuários são convidados pelo painel do Supabase
          (Authentication) e entram como operador.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <UsersTable />
      </Suspense>
    </div>
  );
}

async function UsersTable() {
  const me = await requireRole("admin");
  const { data: users, error } = await listUsers();

  if (error) {
    return (
      <p
        role="alert"
        className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
      >
        Não foi possível carregar os usuários. Tente de novo.
      </p>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Usuário</TableHead>
            <TableHead className="hidden md:table-cell">Status</TableHead>
            <TableHead className="hidden lg:table-cell">Último acesso</TableHead>
            <TableHead>Perfil e acesso</TableHead>
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
                    <StatusBadge active={user.active} />
                  </span>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <StatusBadge active={user.active} />
                </TableCell>
                <TableCell className="hidden tabular-nums lg:table-cell">
                  {user.lastSignInAt
                    ? dateTime.format(new Date(user.lastSignInAt))
                    : "Nunca entrou"}
                </TableCell>
                <TableCell>
                  {user.id === me.id ? (
                    <span className="text-sm">
                      {ROLE_LABELS[user.role]}
                      <span className="block text-xs text-muted-foreground">
                        Você não altera o próprio perfil.
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

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <Badge variant="secondary">Ativo</Badge>
  ) : (
    <Badge variant="outline">Desativado</Badge>
  );
}
