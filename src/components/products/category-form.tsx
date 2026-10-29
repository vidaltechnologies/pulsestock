"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { useI18n } from "@/components/i18n/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ApiErrorBody } from "@/lib/api";
import { categorySchema, type CategoryInput } from "@/lib/validations/product";

export function CategoryForm() {
  const router = useRouter();
  const { t, tm } = useI18n();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CategoryInput>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: "" },
  });

  async function onSubmit(values: CategoryInput) {
    let response: Response;
    try {
      response = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
    } catch {
      setError("name", { message: t.common.connectionError });
      return;
    }

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
      setError("name", { message: body?.error.message ?? t.common.saveError });
      return;
    }

    reset();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-2">
      <Label htmlFor="category-name">{t.categories.newCategory}</Label>
      <div className="flex gap-2">
        <Input
          id="category-name"
          placeholder={t.categories.placeholder}
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? "category-name-error" : undefined}
          {...register("name")}
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
          {t.common.add}
        </Button>
      </div>
      {errors.name && (
        <p id="category-name-error" className="text-sm text-destructive">
          {tm(errors.name.message)}
        </p>
      )}
    </form>
  );
}
