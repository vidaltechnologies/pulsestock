import { beforeAll, describe, expect, it } from "vitest";

import { ADMIN, api, login, RUN } from "./client";

describe("produtos e categorias", () => {
  let token: string;

  beforeAll(async () => {
    token = (await login(ADMIN)).accessToken;
  });

  it("cria, lê e renomeia uma categoria", async () => {
    const created = await api("/categories", { method: "POST", token, body: { name: `Categoria ${RUN}` } });
    expect(created.status).toBe(201);
    expect(created.headers.get("location")).toBe(`/api/v1/categories/${created.body.data.id}`);

    const renamed = await api(`/categories/${created.body.data.id}`, {
      method: "PATCH",
      token,
      body: { name: `Renomeada ${RUN}` },
    });
    expect(renamed.status).toBe(200);
    expect(renamed.body.data.name).toBe(`Renomeada ${RUN}`);

    const read = await api(`/categories/${created.body.data.id}`, { token });
    expect(read.body.data.name).toBe(`Renomeada ${RUN}`);
  });

  it("recusa categoria com nome repetido, sem diferenciar maiúsculas", async () => {
    await api("/categories", { method: "POST", token, body: { name: `Unica ${RUN}` } });
    const duplicate = await api("/categories", { method: "POST", token, body: { name: `UNICA ${RUN}` } });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("conflict");
  });

  it("cadastra produto com saldo zero, Location e SKU único", async () => {
    const body = { sku: `t-${RUN}-1`, name: `Produto ${RUN}`, salePrice: "12,50", minStock: 5 };
    const created = await api("/products", { method: "POST", token, body });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      sku: `T-${RUN}-1`,
      salePrice: 12.5,
      stockQuantity: 0,
      lowStock: true,
      active: true,
    });

    const location = created.headers.get("location")!;
    expect(location).toBe(`/api/v1/products/${created.body.data.id}`);
    const read = await api(location.replace("/api/v1", ""), { token });
    expect(read.body.data.id).toBe(created.body.data.id);

    const duplicate = await api("/products", { method: "POST", token, body });
    expect(duplicate.status).toBe(409);
  });

  it("valida o cadastro campo a campo", async () => {
    const { status, body } = await api("/products", {
      method: "POST",
      token,
      body: { sku: "-x", salePrice: -1 },
    });
    expect(status).toBe(400);
    expect(Object.keys(body.error.details)).toEqual(expect.arrayContaining(["sku", "name", "salePrice"]));
  });

  it("filtra, ordena e pagina a lista", async () => {
    const page = await api("/products?sort=-salePrice&pageSize=5", { token });
    expect(page.status).toBe(200);
    const prices = page.body.data.map((p: { salePrice: number }) => p.salePrice);
    expect(prices).toEqual([...prices].sort((a, b) => b - a));
    expect(page.body.pagination).toMatchObject({
      page: 1,
      pageSize: 5,
      totalPages: Math.ceil(page.body.pagination.total / 5),
    });

    const low = await api("/products?lowStock=true&pageSize=100", { token });
    expect(low.body.data.length).toBeGreaterThan(0);
    expect(low.body.data.every((p: { lowStock: boolean }) => p.lowStock)).toBe(true);

    const search = await api(`/products?q=T-${RUN}-1`, { token });
    expect(search.body.pagination.total).toBe(1);
  });

  it("responde 404 para produto inexistente ou id inválido", async () => {
    expect((await api("/products/nao-e-uuid", { token })).status).toBe(404);
    const missing = await api("/products/00000000-0000-4000-8000-000000000000", { token });
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("not_found");
  });

  it("publica a especificação OpenAPI sem login", async () => {
    const { status, body } = await api("/openapi.json");
    expect(status).toBe(200);
    expect(body.openapi).toBe("3.1.0");
  });
});
