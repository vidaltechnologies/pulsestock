import { describe, expect, it } from "vitest";

import { forgotPasswordSchema, resetPasswordFormSchema, resetPasswordSchema } from "./auth";

describe("forgotPasswordSchema", () => {
  it("normaliza o e-mail e ignora outros campos", () => {
    expect(forgotPasswordSchema.parse({ email: "  Ana@Empresa.COM ", password: "x" })).toEqual({
      email: "ana@empresa.com",
    });
  });

  it("recusa e-mail vazio ou inválido", () => {
    expect(forgotPasswordSchema.safeParse({}).success).toBe(false);
    expect(forgotPasswordSchema.safeParse({ email: "ana" }).success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("aceita senha de 8 a 72 caracteres", () => {
    expect(resetPasswordSchema.parse({ password: "12345678" })).toEqual({ password: "12345678" });
    expect(resetPasswordSchema.safeParse({ password: "a".repeat(72) }).success).toBe(true);
  });

  it("recusa senha curta, longa ou ausente", () => {
    expect(resetPasswordSchema.safeParse({}).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ password: "1234567" }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ password: "a".repeat(73) }).success).toBe(false);
  });
});

describe("resetPasswordFormSchema", () => {
  it("exige a confirmação igual à senha", () => {
    expect(
      resetPasswordFormSchema.safeParse({ password: "senha-boa-1", confirmPassword: "senha-boa-1" }).success,
    ).toBe(true);

    const result = resetPasswordFormSchema.safeParse({
      password: "senha-boa-1",
      confirmPassword: "senha-boa-2",
    });
    expect(result.error?.issues).toEqual([
      expect.objectContaining({ path: ["confirmPassword"], message: "As senhas não são iguais." }),
    ]);
  });
});
