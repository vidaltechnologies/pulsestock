import { z } from "zod";

export const APP_ROLES = ["admin", "operator"] as const;

// Edição de usuário pelo admin: nome, perfil e status. Ao menos um campo.
export const userUpdateSchema = z
  .object({
    fullName: z
      .string({ error: "Informe o nome." })
      .trim()
      .min(1, "Informe o nome.")
      .max(120, "Use no máximo 120 caracteres."),
    role: z.enum(APP_ROLES, { error: "Perfil inválido." }),
    active: z.boolean({ error: "Status inválido." }),
  })
  .partial()
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "Envie ao menos um campo para alterar.",
  });

export type UserUpdateInput = z.output<typeof userUpdateSchema>;
