"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { ApiErrorBody } from "@/lib/api";

// Inativa ou reativa o produto. Produto inativo some da lista padrão e, nas
// próximas etapas, não pode entrar em pedidos novos.
export function ProductStatusButton({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !active }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
        setError(body?.error.message ?? "Não foi possível alterar o status.");
        return;
      }
      router.refresh();
    } catch {
      setError("Não foi possível conectar. Verifique sua internet.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button type="button" variant={active ? "outline" : "secondary"} disabled={pending} onClick={toggle}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        {active ? "Inativar produto" : "Reativar produto"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
