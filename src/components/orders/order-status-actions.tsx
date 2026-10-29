"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { ApiErrorBody } from "@/lib/api";
import { canChangeStatus, type OrderStatus } from "@/lib/validations/order";

const ACTIONS: { status: OrderStatus; label: string; confirm?: string }[] = [
  { status: "confirmed", label: "Confirmar pedido", confirm: "Confirmar o pedido? O estoque dos itens será baixado." },
  { status: "shipped", label: "Marcar como enviado" },
  { status: "delivered", label: "Marcar como entregue" },
];

// Botões de próxima etapa do pedido, conforme o status e o perfil.
export function OrderStatusActions({
  orderId,
  status,
  isAdmin,
}: {
  orderId: string;
  status: OrderStatus;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<OrderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function change(next: OrderStatus, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) {
      return;
    }
    setPending(next);
    setError(null);
    try {
      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
        setError(body?.error.message ?? "Não foi possível mudar o status.");
        return;
      }
      router.refresh();
    } catch {
      setError("Não foi possível conectar. Verifique sua internet.");
    } finally {
      setPending(null);
    }
  }

  const forward = ACTIONS.filter((a) => canChangeStatus(status, a.status, isAdmin));
  const canCancel = canChangeStatus(status, "cancelled", isAdmin);
  if (forward.length === 0 && !canCancel) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        {forward.map((action) => (
          <Button
            key={action.status}
            type="button"
            disabled={pending !== null}
            onClick={() => change(action.status, action.confirm)}
          >
            {pending === action.status && <Loader2 className="animate-spin" aria-hidden />}
            {action.label}
          </Button>
        ))}
        {canCancel && (
          <Button
            type="button"
            variant="outline"
            className="text-destructive hover:text-destructive"
            disabled={pending !== null}
            onClick={() =>
              change(
                "cancelled",
                status === "confirmed"
                  ? "Cancelar o pedido? O estoque dos itens será devolvido."
                  : "Cancelar o pedido?",
              )
            }
          >
            {pending === "cancelled" && <Loader2 className="animate-spin" aria-hidden />}
            Cancelar pedido
          </Button>
        )}
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}
