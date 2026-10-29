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
