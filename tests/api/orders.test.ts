import { beforeAll, describe, expect, it } from "vitest";

import { ADMIN, api, login, OPERATOR, RUN } from "./client";

// A regra central do Pulse Stock: o estoque só baixa quando o pedido é
// confirmado, nunca fica negativo e volta quando um pedido confirmado é
// cancelado.
describe("pedidos e estoque", () => {
  let admin: string;
  let operator: string;
  let productId: string;
  let customerId: string;
  let firstOrderId: string;
  let secondOrderId: string;

  async function stockOf(id: string) {
    const { body } = await api(`/products/${id}`, { token: operator });
    return body.data.stockQuantity as number;
  }

  beforeAll(async () => {
    admin = (await login(ADMIN)).accessToken;
    operator = (await login(OPERATOR)).accessToken;

    const product = await api("/products", {
      method: "POST",
      token: admin,
      body: { sku: `PED-${RUN}`, name: `Produto do pedido ${RUN}`, salePrice: 10 },
    });
    productId = product.body.data.id;

    const customer = await api("/customers", { method: "POST", token: operator, body: { name: `Cliente ${RUN}` } });
    expect(customer.status).toBe(201);
    customerId = customer.body.data.id;
  });

  it("operador registra entrada; saída e ajuste são só do admin", async () => {
    const entry = await api("/stock-movements", {
      method: "POST",
      token: operator,
      body: { productId, type: "in", quantity: 10, reason: "Compra" },
    });
    expect(entry.status).toBe(201);
    expect(entry.body.data.stockQuantity).toBe(10);

    const out = await api("/stock-movements", {
      method: "POST",
      token: operator,
      body: { productId, type: "out", quantity: 1 },
    });
    expect(out.status).toBe(403);
  });

  it("não deixa o saldo ficar negativo numa saída manual", async () => {
    const { status, body } = await api("/stock-movements", {
      method: "POST",
      token: admin,
      body: { productId, type: "out", quantity: 999 },
    });
    expect(status).toBe(409);
    expect(body.error.code).toBe("insufficient_stock");
    expect(await stockOf(productId)).toBe(10);
  });

  it("cria o pedido pendente sem mexer no estoque", async () => {
    const { status, headers, body } = await api("/orders", {
      method: "POST",
      token: operator,
      body: { customerId, items: [{ productId, quantity: 4 }] },
    });
    expect(status).toBe(201);
    expect(headers.get("location")).toBe(`/api/v1/orders/${body.data.id}`);
    expect(body.data).toMatchObject({ status: "pending", totalAmount: 40 });
    firstOrderId = body.data.id;

    expect(await stockOf(productId)).toBe(10);
  });

  it("baixa o estoque ao confirmar", async () => {
    const { status, body } = await api(`/orders/${firstOrderId}/status`, {
      method: "POST",
      token: operator,
      body: { status: "confirmed" },
    });
    expect(status).toBe(200);
    expect(body.data.status).toBe("confirmed");
    expect(await stockOf(productId)).toBe(6);
  });

  it("recusa confirmar sem saldo e não baixa nada", async () => {
    const order = await api("/orders", {
      method: "POST",
      token: operator,
      body: { customerId, items: [{ productId, quantity: 7 }] },
    });
    secondOrderId = order.body.data.id;

    const { status, body } = await api(`/orders/${secondOrderId}/status`, {
      method: "POST",
      token: operator,
      body: { status: "confirmed" },
    });
    expect(status).toBe(409);
    expect(body.error.code).toBe("insufficient_stock");
    expect(await stockOf(productId)).toBe(6);

    const unchanged = await api(`/orders/${secondOrderId}`, { token: operator });
    expect(unchanged.body.data.status).toBe("pending");
  });

  it("recusa transição inválida e edição de pedido confirmado", async () => {
    const skip = await api(`/orders/${secondOrderId}/status`, {
      method: "POST",
      token: operator,
      body: { status: "delivered" },
    });
    expect(skip.status).toBe(409);
    expect(skip.body.error.code).toBe("invalid_transition");

    const edit = await api(`/orders/${firstOrderId}`, {
      method: "PATCH",
      token: operator,
      body: { customerId, items: [{ productId, quantity: 1 }] },
    });
    expect(edit.status).toBe(409);
    expect(edit.body.error.code).toBe("not_editable");
  });

  it("só o admin cancela, e o cancelamento devolve o estoque", async () => {
    const byOperator = await api(`/orders/${firstOrderId}/status`, {
      method: "POST",
      token: operator,
      body: { status: "cancelled" },
    });
    expect(byOperator.status).toBe(403);
    expect(await stockOf(productId)).toBe(6);

    const byAdmin = await api(`/orders/${firstOrderId}/status`, {
      method: "POST",
      token: admin,
      body: { status: "cancelled" },
    });
    expect(byAdmin.status).toBe(200);
    expect(byAdmin.body.data.status).toBe("cancelled");
    expect(await stockOf(productId)).toBe(10);
  });

  it("registra no histórico as movimentações do pedido", async () => {
    const { body } = await api(`/stock-movements?productId=${productId}&sort=createdAt`, { token: operator });
    const fromOrders = body.data.filter((m: { orderId: string | null }) => m.orderId === firstOrderId);
    expect(fromOrders).toHaveLength(2);
  });
});
