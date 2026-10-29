"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useI18n } from "@/components/i18n/i18n-provider";
import { Button } from "@/components/ui/button";
import type { ApiErrorBody } from "@/lib/api";

// Inativa ou reativa um registro (produto, cliente) com PATCH { active }.
// Registro inativo some da lista padrão e não entra em pedidos novos.
export function StatusToggleButton({
  endpoint,
  active,
  noun,
}: {
  endpoint: string;
  active: boolean;
  noun: string;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !active }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
        setError(body?.error.message ?? t.common.statusError);
        return;
      }
      router.refresh();
    } catch {
      setError(t.common.connectionError);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button type="button" variant={active ? "outline" : "secondary"} disabled={pending} onClick={toggle}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        {active ? t.common.deactivate(noun) : t.common.reactivate(noun)}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
