import { beforeAll, describe, expect, it } from "vitest";

import { api, login, OPERATOR, RUN } from "./client";

// O operador usa o dia a dia; cadastro, saídas, ajustes, cancelamentos e
// usuários são do administrador. A API responde 403 antes de chegar ao banco.
describe("perfil operador", () => {
  let token: string;

  beforeAll(async () => {
    token = (await login(OPERATOR)).accessToken;
  });

  it("lê produtos, clientes, pedidos e o dashboard", async () => {
    for (const path of ["/products", "/customers", "/orders", "/stock-movements", "/dashboard", "/categories"]) {
      const { status } = await api(path, { token });
      expect(status, path).toBe(200);
    }
  });

  it("não cadastra produto nem categoria", async () => {
    const product = await api("/products", {
      method: "POST",
      token,
      body: { sku: `OP-${RUN}`, name: "Proibido", salePrice: 1 },
    });
    expect(product.status).toBe(403);
    expect(product.body.error.code).toBe("forbidden");

    const category = await api("/categories", { method: "POST", token, body: { name: `Proibida ${RUN}` } });
    expect(category.status).toBe(403);
  });

  it("não lista nem edita usuários", async () => {
    expect((await api("/users", { token })).status).toBe(403);
  });

  it("não vê margem nem valor de estoque no dashboard", async () => {
    const { body } = await api("/dashboard", { token });
    expect(body.data.monthMargin).toBeNull();
    expect(body.data.stockValue).toBeNull();
  });
});
