import { z } from "zod";

export const refreshTokenSchema = z.object({
  refreshToken: z
    .string({ error: "Informe o refreshToken." })
    .trim()
    .min(1, { error: "Informe o refreshToken." })
    .max(2000, { error: "Informe o refreshToken." }),
});

export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
