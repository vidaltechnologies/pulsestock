import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string({ error: "Informe o e-mail." })
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: "Informe um e-mail válido." })),
  password: z
    .string({ error: "Informe a senha." })
    .min(1, { error: "Informe a senha." })
    .max(72, { error: "A senha pode ter no máximo 72 caracteres." }),
});

export type LoginInput = z.infer<typeof loginSchema>;

// Pedido do link de recuperação: só o e-mail, com as mesmas regras do login.
export const forgotPasswordSchema = loginSchema.pick({ email: true });

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

const newPassword = z
  .string({ error: "Informe a nova senha." })
  .min(8, { error: "Use no mínimo 8 caracteres." })
  .max(72, { error: "A senha pode ter no máximo 72 caracteres." });

// Corpo de POST /api/v1/auth/password/reset.
export const resetPasswordSchema = z.object({ password: newPassword });

// Tela de nova senha: a confirmação é conferida só no navegador.
export const resetPasswordFormSchema = resetPasswordSchema
  .extend({ confirmPassword: z.string({ error: "Confirme a nova senha." }) })
  .refine((values) => values.password === values.confirmPassword, {
    error: "As senhas não são iguais.",
    path: ["confirmPassword"],
  });

export type ResetPasswordFormInput = z.infer<typeof resetPasswordFormSchema>;
