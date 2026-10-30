import { describe, expect, it } from "vitest";

import { stockMovementListQuerySchema, stockMovementSchema } from "./stock";

const productId = "b0000000-0000-4000-8000-000000000001";

function fields(result: { error?: { issues: { path: PropertyKey[] }[] } }) {
  return result.error?.issues.map((issue) => issue.path.join(".")) ?? [];
}

describe("stockMovementSchema", () => {
  it("aceita uma entrada vinda do formulário", () => {
    expect(stockMovementSchema.parse({ productId, type: "in", quantity: "10", reason: "" })).toEqual({
      productId,
      type: "in",
      quantity: 10,
      reason: null,
    });
  });

  it("aceita ajuste negativo", () => {
    expect(stockMovementSchema.parse({ productId, type: "adjustment", quantity: -3 })).toMatchObject({
      quantity: -3,
    });
  });

  it.each([
    ["entrada com zero", { type: "in", quantity: 0 }],
    ["saída negativa", { type: "out", quantity: -2 }],
    ["ajuste zero", { type: "adjustment", quantity: "0" }],
    ["quantidade fracionada", { type: "in", quantity: "1.5" }],
    ["quantidade vazia", { type: "in", quantity: "" }],
  ])("recusa %s", (_label, override) => {
    const result = stockMovementSchema.safeParse({ productId, ...override });
    expect(result.success).toBe(false);
    expect(fields(result)).toContain("quantity");
  });

  it("exige produto e tipo válidos", () => {
    const result = stockMovementSchema.safeParse({ productId: "", type: "venda", quantity: 1 });
    expect(fields(result)).toEqual(expect.arrayContaining(["productId", "type"]));
  });

  it("limita o motivo a 500 caracteres", () => {
    const result = stockMovementSchema.safeParse({ productId, type: "in", quantity: 1, reason: "x".repeat(501) });
    expect(fields(result)).toContain("reason");
  });
});

describe("stockMovementListQuerySchema", () => {
  it("ignora filtros inválidos", () => {
    expect(stockMovementListQuerySchema.parse({ productId: "x", type: "venda", page: "0" })).toEqual({
      productId: undefined,
      type: undefined,
      sort: "-createdAt",
      page: 1,
      pageSize: 20,
    });
  });
});
