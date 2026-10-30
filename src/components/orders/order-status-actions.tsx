"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useI18n } from "@/components/i18n/i18n-provider";
import { Button } from "@/components/ui/button";
import type { ApiErrorBody } from "@/lib/api";
import type { Dictionary } from "@/lib/i18n";
import { canChangeStatus, type OrderStatus } from "@/lib/validations/order";

const ACTIONS = [
  { status: "confirmed", label: "confirm", confirm: "confirmQuestion" },
  { status: "shipped", label: "ship" },
  { status: "delivered", label: "deliver" },
] as const satisfies {
  status: OrderStatus;
  label: keyof Dictionary["orders"]["actions"];
  confirm?: keyof Dictionary["orders"]["actions"];
}[];

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
  const { t } = useI18n();
  const [pending, setPending] = useState<OrderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function change(next: OrderStatus, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) {
      return;
    }
    setPending(next);
    setError(null);
    try {
      const response = await fetch(`/api/v1/orders/${orderId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
        setError(body?.error.message ?? t.orders.actions.error);
        return;
      }
      router.refresh();
    } catch {
      setError(t.common.connectionError);
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
            onClick={() => change(action.status, "confirm" in action ? t.orders.actions[action.confirm] : undefined)}
          >
            {pending === action.status && <Loader2 className="animate-spin" aria-hidden />}
            {t.orders.actions[action.label]}
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
                  ? t.orders.actions.cancelConfirmedQuestion
                  : t.orders.actions.cancelQuestion,
              )
            }
          >
            {pending === "cancelled" && <Loader2 className="animate-spin" aria-hidden />}
            {t.orders.actions.cancel}
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
