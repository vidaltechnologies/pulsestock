"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { useI18n } from "@/components/i18n/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ApiErrorBody } from "@/lib/api";
import { resetPasswordFormSchema, type ResetPasswordFormInput } from "@/lib/validations/auth";

export function ResetPasswordForm() {
  const router = useRouter();
  const { t, tm } = useI18n();
  const [formError, setFormError] = useState<{ message: string; expired: boolean } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormInput>({
    resolver: zodResolver(resetPasswordFormSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  async function onSubmit({ password }: ResetPasswordFormInput) {
    setFormError(null);

    let response: Response;
    try {
      response = await fetch("/api/v1/auth/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
    } catch {
      setFormError({ message: t.common.connectionError, expired: false });
      return;
    }

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
      setFormError({
        message: body?.error.message ?? t.messages.unexpected,
        expired: response.status === 401,
      });
      return;
    }

    // A sessão de recuperação foi encerrada: entra de novo com a senha nova.
    router.replace("/login?motivo=senha-alterada");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">{t.resetPassword.password}</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? "password-error" : undefined}
          {...register("password")}
        />
        {errors.password && (
          <p id="password-error" className="text-sm text-destructive">
            {tm(errors.password.message)}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="confirmPassword">{t.resetPassword.confirmPassword}</Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.confirmPassword}
          aria-describedby={errors.confirmPassword ? "confirm-password-error" : undefined}
          {...register("confirmPassword")}
        />
        {errors.confirmPassword && (
          <p id="confirm-password-error" className="text-sm text-destructive">
            {tm(errors.confirmPassword.message)}
          </p>
        )}
      </div>

      {formError && (
        <div
          role="alert"
          className="flex flex-col gap-1 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          <p>{formError.message}</p>
          {formError.expired && (
            <Link href="/esqueci-senha" className="font-medium underline underline-offset-4">
              {t.resetPassword.requestNew}
            </Link>
          )}
        </div>
      )}

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
        {t.resetPassword.submit}
      </Button>
    </form>
  );
}
