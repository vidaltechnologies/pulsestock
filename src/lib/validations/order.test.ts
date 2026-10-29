import { describe, expect, it } from "vitest";

import { canChangeStatus, orderListQuerySchema, orderSchema, orderStatusChangeSchema } from "./order";

const customerId = "d0000000-0000-4000-8000-000000000001";
const productId = "b0000000-0000-4000-8000-000000000001";

function fields(result: { error?: { issues: { path: PropertyKey[] }[] } }) {
  return result.error?.issues.map((issue) => issue.path.join(".")) ?? [];
}

describe("orderSchema", () => {
  it("aceita pedido do formulário", () => {
    expect(
      orderSchema.parse({ customerId, notes: " ", items: [{ productId, quantity: "3" }] }),
    ).toEqual({ customerId, notes: null, items: [{ productId, quantity: 3 }] });
  });

  it("exige cliente e ao menos um item", () => {
    const result = orderSchema.safeParse({ customerId: "", items: [] });
    expect(fields(result)).toEqual(expect.arrayContaining(["customerId", "items"]));
  });

  it.each([
    ["quantidade zero", 0],
    ["quantidade negativa", -1],
    ["quantidade fracionada", 1.5],
    ["quantidade vazia", ""],
  ])("recusa %s", (_label, qty) => {
    const result = orderSchema.safeParse({ customerId, items: [{ productId, quantity: qty }] });
    expect(fields(result)).toContain("items.0.quantity");
  });

  it("ignora campos que a API não grava, como preço e total", () => {
    const result = orderSchema.parse({
      customerId,
      totalAmount: 1,
      items: [{ productId, quantity: 1, unitPrice: 0 }],
    });
    expect(result).not.toHaveProperty("totalAmount");
    expect(result.items[0]).not.toHaveProperty("unitPrice");
  });
});

describe("canChangeStatus", () => {
  it("segue o fluxo pendente → confirmado → enviado → entregue", () => {
    expect(canChangeStatus("pending", "confirmed", false)).toBe(true);
    expect(canChangeStatus("confirmed", "shipped", false)).toBe(true);
    expect(canChangeStatus("shipped", "delivered", false)).toBe(true);
    expect(canChangeStatus("pending", "shipped", false)).toBe(false);
    expect(canChangeStatus("delivered", "confirmed", true)).toBe(false);
  });

  it("só admin cancela, e só antes do envio", () => {
    expect(canChangeStatus("pending", "cancelled", false)).toBe(false);
    expect(canChangeStatus("pending", "cancelled", true)).toBe(true);
    expect(canChangeStatus("confirmed", "cancelled", true)).toBe(true);
    expect(canChangeStatus("shipped", "cancelled", true)).toBe(false);
  });
});

describe("orderStatusChangeSchema", () => {
  it("não aceita voltar para pendente", () => {
    expect(orderStatusChangeSchema.safeParse({ status: "pending" }).success).toBe(false);
    expect(orderStatusChangeSchema.parse({ status: "shipped" })).toEqual({ status: "shipped" });
  });
});

describe("orderListQuerySchema", () => {
  it("ignora filtros inválidos", () => {
    expect(orderListQuerySchema.parse({ status: "x", page: "-1", customerId: "x" })).toEqual({
      q: "",
      status: undefined,
      customerId: undefined,
      page: 1,
      pageSize: 20,
    });
  });
});
