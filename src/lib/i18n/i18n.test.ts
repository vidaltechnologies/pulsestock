import { describe, expect, it } from "vitest";
import type { z } from "zod";

import { getFormat } from "@/lib/format";
import { getDictionary, translateMessage } from "@/lib/i18n";
import { localeFromAcceptLanguage } from "@/lib/i18n/config";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordFormSchema,
  resetPasswordSchema,
} from "@/lib/validations/auth";
import { refreshTokenSchema } from "@/lib/validations/auth-token";
import { customerSchema } from "@/lib/validations/customer";
import { orderSchema, orderStatusChangeSchema } from "@/lib/validations/order";
import { categorySchema, productSchema, productUpdateSchema } from "@/lib/validations/product";
import { stockMovementSchema } from "@/lib/validations/stock";
import { userUpdateSchema } from "@/lib/validations/user";

describe("localeFromAcceptLanguage", () => {
  it("usa o primeiro idioma suportado na ordem de preferência", () => {
    expect(localeFromAcceptLanguage("en-US,en;q=0.9,pt;q=0.8")).toBe("en");
    expect(localeFromAcceptLanguage("fr-FR,es;q=0.7,en;q=0.5")).toBe("es");
    expect(localeFromAcceptLanguage("pt;q=0.4,en;q=0.9")).toBe("en");
  });

  it("cai no português sem idioma suportado", () => {
    expect(localeFromAcceptLanguage(null)).toBe("pt");
    expect(localeFromAcceptLanguage("fr-FR,de;q=0.8")).toBe("pt");
    expect(localeFromAcceptLanguage("en;q=0")).toBe("pt");
  });
});

describe("translateMessage", () => {
  it("traduz mensagens fixas e mantém o português", () => {
    expect(translateMessage("Informe o SKU.", "en")).toBe("Enter the SKU.");
    expect(translateMessage("Informe o SKU.", "es")).toBe("Ingresa el SKU.");
    expect(translateMessage("Informe o SKU.", "pt")).toBe("Informe o SKU.");
  });

  it("traduz mensagens com valores do banco", () => {
    expect(
      translateMessage('Estoque insuficiente para "Café 500 g": o pedido tem 12 e o saldo é 3 UN.', "en"),
    ).toBe('Insufficient stock for "Café 500 g": the order has 12 and the stock is 3 UN.');
    expect(translateMessage("Estoque insuficiente: o saldo atual é 1500 UN.", "es")).toBe(
      "Inventario insuficiente: el saldo actual es 1500 UN.",
    );
    expect(translateMessage("Use no máximo 120 caracteres.", "en")).toBe("Use at most 120 characters.");
  });

  it("mostra o status pelo nome, inclusive em português", () => {
    expect(translateMessage('Não é possível mudar o pedido de "delivered" para "cancelled".', "pt")).toBe(
      'Não é possível mudar o pedido de "Entregue" para "Cancelado".',
    );
    expect(translateMessage('Não é possível mudar o pedido de "pending" para "shipped".', "en")).toBe(
      'The order can\'t go from "Pending" to "Shipped".',
    );
  });

  it("devolve mensagem desconhecida como veio", () => {
    expect(translateMessage("Algo novo.", "en")).toBe("Algo novo.");
    expect(translateMessage(undefined, "en")).toBeUndefined();
  });
});

// Toda mensagem que os esquemas Zod produzem precisa ter tradução.
describe("mensagens de validação", () => {
  const invalid: [z.ZodType, unknown][] = [
    [loginSchema, {}],
    [loginSchema, { email: "x", password: "a".repeat(80) }],
    [forgotPasswordSchema, {}],
    [forgotPasswordSchema, { email: "x" }],
    [resetPasswordSchema, {}],
    [resetPasswordFormSchema, { password: "curta" }],
    [resetPasswordFormSchema, { password: "a".repeat(80), confirmPassword: "b" }],
    [resetPasswordFormSchema, { password: "senha-boa-1", confirmPassword: "outra-senha" }],
    [refreshTokenSchema, {}],
    [refreshTokenSchema, { refreshToken: " " }],
    [productSchema, {}],
    [productSchema, { sku: "-x", name: "a".repeat(200), salePrice: "-1", costPrice: "1,234", minStock: "1.5", categoryId: "x" }],
    [productSchema, { sku: "A", name: "B", salePrice: "abc", minStock: "-1", unit: "a".repeat(20) }],
    [productSchema, { sku: "A", name: "B", salePrice: "99999999999" }],
    [productUpdateSchema, {}],
    [productUpdateSchema, { unit: "" }],
    [categorySchema, {}],
    [stockMovementSchema, {}],
    [stockMovementSchema, { productId: "x", type: "adjustment", quantity: "0", reason: "a".repeat(600) }],
    [stockMovementSchema, { type: "in", quantity: "-2" }],
    [stockMovementSchema, { type: "in", quantity: "2.5" }],
    [orderSchema, {}],
    [orderSchema, { customerId: "x", items: [] }],
    [orderSchema, { items: [{ productId: "x", quantity: "0" }] }],
    [orderSchema, { items: [{ quantity: "abc" }] }],
    [orderStatusChangeSchema, { status: "x" }],
    [customerSchema, {}],
    [customerSchema, { name: "A", document: "123", email: "x", state: "XX", city: "a".repeat(100) }],
    [customerSchema, { name: "A", document: "11111111111", email: `${"a".repeat(260)}@x.com` }],
    [userUpdateSchema, {}],
    [userUpdateSchema, { role: "x", active: "x", fullName: "" }],
  ];

  const messages = new Set<string>();
  for (const [schema, value] of invalid) {
    const result = schema.safeParse(value);
    result.error?.issues.forEach((issue) => messages.add(issue.message));
  }

  // Em espanhol algumas ficam iguais ("Perfil inválido."), então basta o inglês.
  it.each([...messages])("%s", (message) => {
    expect(translateMessage(message, "en")).not.toBe(message);
  });
});

describe("dicionários", () => {
  it("têm as mesmas chaves nos três idiomas", () => {
    const keys = (value: unknown, prefix = ""): string[] =>
      value && typeof value === "object"
        ? Object.entries(value).flatMap(([k, v]) => keys(v, `${prefix}${k}.`))
        : [prefix];
    const pt = keys(getDictionary("pt")).sort();
    expect(keys(getDictionary("en")).sort()).toEqual(pt);
    expect(keys(getDictionary("es")).sort()).toEqual(pt);
  });
});

describe("getFormat", () => {
  it("formata moeda e datas no padrão de cada idioma", () => {
    // O Intl separa "R$" do valor com espaço sem quebra.
    expect(getFormat("pt").currency(1234.5)).toBe("R$\u00a01.234,50");
    expect(getFormat("en").currency(1234.5)).toBe("R$1,234.50");
    expect(getFormat("es").currency(12345.5)).toBe("12.345,50\u00a0R$");
    expect(getFormat("pt").day("2026-10-29")).toBe("29/10/2026");
    expect(getFormat("en").day("2026-10-29")).toBe("10/29/26");
    expect(getFormat("pt").shortDay("2026-10-05")).toBe("05/10");
    expect(getFormat("en").shortDay("2026-10-05")).toBe("10/05");
  });
});
