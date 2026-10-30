"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useI18n } from "@/components/i18n/i18n-provider";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { ApiErrorBody } from "@/lib/api";
import type { AppRole } from "@/lib/auth";

const ROLE_OPTIONS: AppRole[] = ["operator", "admin"];

// Perfil e status de um usuário, alterados pelo admin com PATCH /api/v1/users/{id}.
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
  const { t } = useI18n();
  const [pending, setPending] = useState<"role" | "active" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(change: { role: AppRole } | { active: boolean }, question: string) {
    if (!window.confirm(question)) {
      return false;
    }
    setPending("role" in change ? "role" : "active");
    setError(null);
    try {
      const response = await fetch(`/api/v1/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(change),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
        setError(body?.error.message ?? t.users.error);
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError(t.common.connectionError);
      return false;
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect
          aria-label={t.users.roleOf(name)}
          value={role}
          disabled={pending !== null}
          onChange={(e) => {
            const next = e.target.value as AppRole;
            void save({ role: next }, t.users.changeRole(name, t.roles[next].toLowerCase()));
          }}
        >
          {ROLE_OPTIONS.map((option) => (
            <NativeSelectOption key={option} value={option}>
              {t.roles[option]}
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
              active ? t.users.deactivateQuestion(name) : t.users.reactivateQuestion(name),
            )
          }
        >
          {pending === "active" && <Loader2 className="animate-spin" aria-hidden />}
          {active ? t.users.deactivate : t.users.reactivate}
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
