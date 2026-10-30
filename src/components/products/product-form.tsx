"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, type FieldPath } from "react-hook-form";

import { useI18n } from "@/components/i18n/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { ApiErrorBody } from "@/lib/api";
import type { Category, Product } from "@/lib/data/products";
import {
  productSchema,
  type ProductFormValues,
  type ProductInput,
} from "@/lib/validations/product";

function toFormValues(product?: Product): ProductFormValues {
  return {
    sku: product?.sku ?? "",
    name: product?.name ?? "",
    description: product?.description ?? "",
    categoryId: product?.category?.id ?? "",
    unit: product?.unit ?? "UN",
    costPrice: product ? String(product.costPrice) : "",
    salePrice: product ? String(product.salePrice) : "",
    minStock: product ? String(product.minStock) : "0",
    active: product?.active ?? true,
  };
}

// Cadastro e edição de produto. Valida no navegador com o mesmo esquema Zod
// da API e mostra os erros devolvidos por ela (SKU repetido, por exemplo).
export function ProductForm({
  product,
  categories,
}: {
  product?: Product;
  categories: Category[];
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues, unknown, ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: toFormValues(product),
  });

  async function onSubmit(values: ProductInput) {
    setFormError(null);

    // Na edição, o status muda só pelo botão de inativar, para o formulário
    // não desfazer essa mudança com um valor antigo.
    const payload: Partial<ProductInput> = { ...values };
    if (product) {
      delete payload.active;
    }

    let response: Response;
    try {
      response = await fetch(product ? `/api/v1/products/${product.id}` : "/api/v1/products", {
        method: product ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      setFormError(t.common.connectionError);
      return;
    }

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
      if (body?.error.code === "conflict") {
        setError("sku", { message: body.error.message });
        return;
      }
      if (body?.error.code === "validation_error" && body.error.details) {
        const fieldErrors = body.error.details as Record<string, string[] | undefined>;
        for (const [field, messages] of Object.entries(fieldErrors)) {
          if (messages?.[0]) {
            setError(field as FieldPath<ProductFormValues>, { message: messages[0] });
          }
        }
      }
      setFormError(body?.error.message ?? t.common.saveError);
      return;
    }

    router.push("/produtos");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex max-w-2xl flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-[12rem_1fr]">
        <Field id="sku" label={t.products.sku} error={errors.sku?.message}>
          <Input
            id="sku"
            autoComplete="off"
            className="font-mono uppercase"
            placeholder={t.products.form.skuPlaceholder}
            aria-invalid={!!errors.sku}
            aria-describedby={errors.sku ? "sku-error" : undefined}
            {...register("sku")}
          />
        </Field>
        <Field id="name" label={t.common.name} error={errors.name?.message}>
          <Input
            id="name"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "name-error" : undefined}
            {...register("name")}
          />
        </Field>
      </div>

      <Field id="description" label={t.products.form.description} error={errors.description?.message}>
        <Textarea
          id="description"
          rows={3}
          aria-invalid={!!errors.description}
          aria-describedby={errors.description ? "description-error" : undefined}
          {...register("description")}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-[1fr_8rem]">
        <Field id="categoryId" label={t.products.category} error={errors.categoryId?.message}>
          <NativeSelect
            id="categoryId"
            className="w-full" wrapperClassName="w-full"
            aria-invalid={!!errors.categoryId}
            {...register("categoryId")}
          >
            <NativeSelectOption value="">{t.products.noCategory}</NativeSelectOption>
            {categories.map((category) => (
              <NativeSelectOption key={category.id} value={category.id}>
                {category.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field id="unit" label={t.products.form.unit} error={errors.unit?.message}>
          <Input
            id="unit"
            className="uppercase"
            placeholder="UN"
            aria-invalid={!!errors.unit}
            aria-describedby={errors.unit ? "unit-error" : undefined}
            {...register("unit")}
          />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <Field id="costPrice" label={t.products.form.costPrice} error={errors.costPrice?.message}>
          <Input
            id="costPrice"
            inputMode="decimal"
            placeholder={t.products.form.decimalPlaceholder}
            aria-invalid={!!errors.costPrice}
            aria-describedby={errors.costPrice ? "costPrice-error" : undefined}
            {...register("costPrice")}
          />
        </Field>
        <Field id="salePrice" label={t.products.form.salePrice} error={errors.salePrice?.message}>
          <Input
            id="salePrice"
            inputMode="decimal"
            placeholder={t.products.form.decimalPlaceholder}
            aria-invalid={!!errors.salePrice}
            aria-describedby={errors.salePrice ? "salePrice-error" : undefined}
            {...register("salePrice")}
          />
        </Field>
        <Field id="minStock" label={t.products.form.minStock} error={errors.minStock?.message}>
          <Input
            id="minStock"
            inputMode="numeric"
            aria-invalid={!!errors.minStock}
            aria-describedby={errors.minStock ? "minStock-error" : undefined}
            {...register("minStock")}
          />
        </Field>
      </div>

      {!product && (
        <p className="text-sm text-muted-foreground">
          {t.products.form.startsAtZero}
        </p>
      )}

      {formError && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {formError}
        </p>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
          {product ? t.common.saveChanges : t.products.form.create}
        </Button>
        <Button asChild variant="outline">
          <Link href="/produtos">{t.common.cancel}</Link>
        </Button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  const { tm } = useI18n();
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {tm(error)}
        </p>
      )}
    </div>
  );
}
