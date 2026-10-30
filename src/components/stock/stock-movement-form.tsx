"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch, type FieldPath } from "react-hook-form";

import { useI18n } from "@/components/i18n/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { ApiErrorBody } from "@/lib/api";
import type { AppRole } from "@/lib/auth";
import type { ProductOption } from "@/lib/data/products";
import {
  ADMIN_ONLY_TYPES,
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
  const { t, f, tm } = useI18n();
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const types = STOCK_MOVEMENT_TYPES.filter((type) => role === "admin" || !ADMIN_ONLY_TYPES.includes(type));

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
      response = await fetch("/api/v1/stock-movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
    } catch {
      setFormError(t.common.connectionError);
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
      setFormError(body?.error?.message ?? t.stock.form.error);
      return;
    }

    const product = products.find((p) => p.id === values.productId);
    setSuccess(
      t.stock.form.success(
        t.stock.types[values.type],
        product?.name ?? "",
        f.integer(body?.data.stockQuantity ?? 0),
        product?.unit ?? "",
      ),
    );
    resetField("quantity");
    resetField("reason");
    router.refresh();
  }

  if (products.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t.stock.form.noProducts}
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="productId">{t.common.product}</Label>
        <NativeSelect id="productId" className="w-full" wrapperClassName="w-full" aria-invalid={!!errors.productId} {...register("productId")}>
          <NativeSelectOption value="">{t.common.chooseProduct}</NativeSelectOption>
          {products.map((p) => (
            <NativeSelectOption key={p.id} value={p.id}>
              {p.sku} · {p.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {errors.productId ? (
          <p className="text-sm text-destructive">{tm(errors.productId.message)}</p>
        ) : (
          selected && (
            <p className="text-sm text-muted-foreground">
              {t.common.currentStock(f.integer(selected.stockQuantity), selected.unit)}
            </p>
          )
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="type">{t.common.type}</Label>
          <NativeSelect id="type" className="w-full" wrapperClassName="w-full" {...register("type")}>
            {types.map((type) => (
              <NativeSelectOption key={type} value={type}>
                {t.stock.types[type]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="quantity">{type === "adjustment" ? t.stock.form.difference : t.common.quantity}</Label>
          <Input
            id="quantity"
            inputMode="numeric"
            placeholder={type === "adjustment" ? t.stock.form.adjustmentPlaceholder : t.stock.form.quantityPlaceholder}
            aria-invalid={!!errors.quantity}
            aria-describedby={errors.quantity ? "quantity-error" : undefined}
            {...register("quantity")}
          />
        </div>
      </div>
      {errors.quantity ? (
        <p id="quantity-error" className="-mt-2 text-sm text-destructive">
          {tm(errors.quantity.message)}
        </p>
      ) : (
        type === "adjustment" && (
          <p className="-mt-2 text-sm text-muted-foreground">
            {t.stock.form.adjustmentHint}
          </p>
        )
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="reason">{t.stock.form.reason}</Label>
        <Input
          id="reason"
          placeholder={t.stock.form.reasonPlaceholder}
          aria-invalid={!!errors.reason}
          {...register("reason")}
        />
        {errors.reason && <p className="text-sm text-destructive">{tm(errors.reason.message)}</p>}
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
        {t.stock.form.submit}
      </Button>
    </form>
  );
}
