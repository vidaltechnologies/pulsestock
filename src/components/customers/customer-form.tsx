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
import type { ApiErrorBody } from "@/lib/api";
import type { Customer } from "@/lib/data/customers";
import {
  BRAZILIAN_STATES,
  customerSchema,
  formatDocument,
  type CustomerFormValues,
  type CustomerInput,
} from "@/lib/validations/customer";

function toFormValues(customer?: Customer): CustomerFormValues {
  return {
    name: customer?.name ?? "",
    document: customer?.document ? formatDocument(customer.document) : "",
    email: customer?.email ?? "",
    phone: customer?.phone ?? "",
    city: customer?.city ?? "",
    state: customer?.state ?? "",
    active: customer?.active ?? true,
  };
}

// Cadastro e edição de cliente, com o mesmo esquema Zod da API.
export function CustomerForm({ customer }: { customer?: Customer }) {
  const router = useRouter();
  const { t } = useI18n();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormValues, unknown, CustomerInput>({
    resolver: zodResolver(customerSchema),
    defaultValues: toFormValues(customer),
  });

  async function onSubmit(values: CustomerInput) {
    setFormError(null);

    // O status muda só pelo botão de inativar (e só para admin).
    const payload: Partial<CustomerInput> = { ...values };
    delete payload.active;

    let response: Response;
    try {
      response = await fetch(customer ? `/api/customers/${customer.id}` : "/api/customers", {
        method: customer ? "PATCH" : "POST",
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
        setError("document", { message: body.error.message });
        return;
      }
      if (body?.error.code === "validation_error" && body.error.details) {
        const fieldErrors = body.error.details as Record<string, string[] | undefined>;
        for (const [field, messages] of Object.entries(fieldErrors)) {
          if (messages?.[0]) {
            setError(field as FieldPath<CustomerFormValues>, { message: messages[0] });
          }
        }
      }
      setFormError(body?.error.message ?? t.common.saveError);
      return;
    }

    router.push("/clientes");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex max-w-2xl flex-col gap-5">
      <Field id="name" label={t.customers.form.name} error={errors.name?.message}>
        <Input id="name" aria-invalid={!!errors.name} {...register("name")} />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="document" label={t.customers.form.document} error={errors.document?.message}>
          <Input
            id="document"
            inputMode="numeric"
            placeholder="000.000.000-00"
            aria-invalid={!!errors.document}
            {...register("document")}
          />
        </Field>
        <Field id="phone" label={t.customers.form.phone} error={errors.phone?.message}>
          <Input
            id="phone"
            type="tel"
            placeholder="(81) 99999-0000"
            aria-invalid={!!errors.phone}
            {...register("phone")}
          />
        </Field>
      </div>

      <Field id="email" label={t.customers.form.email} error={errors.email?.message}>
        <Input id="email" type="email" aria-invalid={!!errors.email} {...register("email")} />
      </Field>

      <div className="grid gap-5 sm:grid-cols-[1fr_8rem]">
        <Field id="city" label={t.customers.form.city} error={errors.city?.message}>
          <Input id="city" aria-invalid={!!errors.city} {...register("city")} />
        </Field>
        <Field id="state" label={t.customers.form.state} error={errors.state?.message}>
          <NativeSelect
            id="state"
            className="w-full"
            wrapperClassName="w-full"
            aria-invalid={!!errors.state}
            {...register("state")}
          >
            <NativeSelectOption value="">—</NativeSelectOption>
            {BRAZILIAN_STATES.map((uf) => (
              <NativeSelectOption key={uf} value={uf}>
                {uf}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      </div>

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
          {customer ? t.common.saveChanges : t.customers.form.create}
        </Button>
        <Button asChild variant="outline">
          <Link href="/clientes">{t.common.cancel}</Link>
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
