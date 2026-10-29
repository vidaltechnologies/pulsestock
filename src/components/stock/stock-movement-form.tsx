"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch, type FieldPath } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { ApiErrorBody } from "@/lib/api";
import type { AppRole } from "@/lib/auth";
import type { ProductOption } from "@/lib/data/products";
import { formatInteger } from "@/lib/format";
import {
  ADMIN_ONLY_TYPES,
  STOCK_MOVEMENT_LABELS,
  STOCK_MOVEMENT_TYPES,
  stockMovementSchema,
  type StockMovementFormValues,
  type StockMovementInput,
} from "@/lib/validations/stock";

export function StockMovementForm({
  products,
  role,
  defaultProductId,
}: {
  products: ProductOption[];
  role: AppRole;
  defaultProductId?: string;
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const types = STOCK_MOVEMENT_TYPES.filter((t) => role === "admin" || !ADMIN_ONLY_TYPES.includes(t));

  const {
    register,
    handleSubmit,
    setError,
    resetField,
    control,
    formState: { errors, isSubmitting },
  } = useForm<StockMovementFormValues, unknown, StockMovementInput>({
    resolver: zodResolver(stockMovementSchema),
    defaultValues: {
      productId: products.some((p) => p.id === defaultProductId) ? defaultProductId : "",
      type: "in",
      quantity: "",
      reason: "",
    },
  });

  const [productId, type] = useWatch({ control, name: ["productId", "type"] });
  const selected = products.find((p) => p.id === productId);

  async function onSubmit(values: StockMovementInput) {
    setFormError(null);
    setSuccess(null);

    let response: Response;
    try {
      response = await fetch("/api/stock-movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
    } catch {
      setFormError("Não foi possível conectar. Verifique sua internet.");
      return;
    }

    const body = (await response.json().catch(() => null)) as
      | ({ data: { stockQuantity: number } } & Partial<ApiErrorBody>)
      | null;

    if (!response.ok) {
      if (body?.error?.code === "insufficient_stock") {
        setError("quantity", { message: body.error.message });
        return;
      }
      if (body?.error?.code === "validation_error" && body.error.details) {
        const fieldErrors = body.error.details as Record<string, string[] | undefined>;
        for (const [field, messages] of Object.entries(fieldErrors)) {
          if (messages?.[0]) {
            setError(field as FieldPath<StockMovementFormValues>, { message: messages[0] });
          }
        }
      }
      setFormError(body?.error?.message ?? "Não foi possível registrar. Tente de novo.");
      return;
    }

    const product = products.find((p) => p.id === values.productId);
    setSuccess(
      `${STOCK_MOVEMENT_LABELS[values.type]} registrada. Novo saldo de ${product?.name ?? "produto"}: ${formatInteger(body?.data.stockQuantity ?? 0)} ${product?.unit ?? ""}.`,
    );
    resetField("quantity");
    resetField("reason");
    router.refresh();
  }

  if (products.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Cadastre um produto ativo para registrar movimentações.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="productId">Produto</Label>
        <NativeSelect id="productId" className="w-full" wrapperClassName="w-full" aria-invalid={!!errors.productId} {...register("productId")}>
          <NativeSelectOption value="">Escolha um produto</NativeSelectOption>
          {products.map((p) => (
            <NativeSelectOption key={p.id} value={p.id}>
              {p.sku} · {p.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {errors.productId ? (
          <p className="text-sm text-destructive">{errors.productId.message}</p>
        ) : (
          selected && (
            <p className="text-sm text-muted-foreground">
              Saldo atual: {formatInteger(selected.stockQuantity)} {selected.unit}
            </p>
          )
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="type">Tipo</Label>
          <NativeSelect id="type" className="w-full" wrapperClassName="w-full" {...register("type")}>
            {types.map((t) => (
              <NativeSelectOption key={t} value={t}>
                {STOCK_MOVEMENT_LABELS[t]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="quantity">{type === "adjustment" ? "Diferença" : "Quantidade"}</Label>
          <Input
            id="quantity"
            inputMode="numeric"
            placeholder={type === "adjustment" ? "Ex.: -3 ou 5" : "Ex.: 10"}
            aria-invalid={!!errors.quantity}
            aria-describedby={errors.quantity ? "quantity-error" : undefined}
            {...register("quantity")}
          />
        </div>
      </div>
      {errors.quantity ? (
        <p id="quantity-error" className="-mt-2 text-sm text-destructive">
          {errors.quantity.message}
        </p>
      ) : (
        type === "adjustment" && (
          <p className="-mt-2 text-sm text-muted-foreground">
            Use um número negativo para reduzir o saldo e positivo para aumentar.
          </p>
        )
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="reason">Motivo (opcional)</Label>
        <Input
          id="reason"
          placeholder="Ex.: nota fiscal 1234, contagem mensal"
          aria-invalid={!!errors.reason}
          {...register("reason")}
        />
        {errors.reason && <p className="text-sm text-destructive">{errors.reason.message}</p>}
      </div>

      {formError && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {formError}
        </p>
      )}
      {success && (
        <p role="status" className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          {success}
        </p>
      )}

      <Button type="submit" disabled={isSubmitting} className="self-start">
        {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
        Registrar movimentação
      </Button>
    </form>
  );
}
