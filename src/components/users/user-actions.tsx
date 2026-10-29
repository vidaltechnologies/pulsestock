"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { ApiErrorBody } from "@/lib/api";
import type { AppRole } from "@/lib/auth";

const ROLE_OPTIONS: { value: AppRole; label: string }[] = [
  { value: "operator", label: "Operador" },
  { value: "admin", label: "Administrador" },
];

// Perfil e status de um usuário, alterados pelo admin com PATCH /api/users/{id}.
export function UserActions({
  id,
  name,
  role,
  active,
}: {
  id: string;
  name: string;
  role: AppRole;
  active: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"role" | "active" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(change: { role: AppRole } | { active: boolean }, question: string) {
    if (!window.confirm(question)) {
      return false;
    }
    setPending("role" in change ? "role" : "active");
    setError(null);
    try {
      const response = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(change),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
        setError(body?.error.message ?? "Não foi possível alterar o usuário.");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("Não foi possível conectar. Verifique sua internet.");
      return false;
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect
          aria-label={`Perfil de ${name}`}
          value={role}
          disabled={pending !== null}
          onChange={(e) => {
            const next = e.target.value as AppRole;
            const label = ROLE_OPTIONS.find((o) => o.value === next)?.label.toLowerCase();
            void save({ role: next }, `Mudar o perfil de ${name} para ${label}?`);
          }}
        >
          {ROLE_OPTIONS.map((option) => (
            <NativeSelectOption key={option.value} value={option.value}>
              {option.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Button
          type="button"
          size="sm"
          variant={active ? "outline" : "secondary"}
          disabled={pending !== null}
          onClick={() =>
            void save(
              { active: !active },
              active ? `Desativar ${name}? A pessoa perde o acesso na hora.` : `Reativar ${name}?`,
            )
          }
        >
          {pending === "active" && <Loader2 className="animate-spin" aria-hidden />}
          {active ? "Desativar" : "Reativar"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
