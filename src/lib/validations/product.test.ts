import { describe, expect, it } from "vitest";

import {
  categorySchema,
  productListQuerySchema,
  productSchema,
  productUpdateSchema,
} from "./product";

const valid = { sku: "cam-001", name: "Camiseta", salePrice: "49,90" };

function fieldErrors(result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) {
  return result.error?.issues.map((issue) => issue.path.join(".")) ?? [];
}

describe("productSchema", () => {
  it("normaliza o formulário e aplica os padrões", () => {
    const result = productSchema.parse({
      ...valid,
      description: "",
      categoryId: "",
      unit: "",
      costPrice: "",
      minStock: "",
    });

    expect(result).toEqual({
      sku: "CAM-001",
      name: "Camiseta",
      description: null,
      categoryId: null,
      unit: "UN",
      costPrice: 0,
      salePrice: 49.9,
      minStock: 0,
      active: true,
    });
  });

  it("aceita números vindos do JSON da API", () => {
    const result = productSchema.parse({ ...valid, salePrice: 10, costPrice: 7.5, minStock: 3 });
    expect(result).toMatchObject({ salePrice: 10, costPrice: 7.5, minStock: 3 });
  });

  it("exige SKU, nome e preço de venda", () => {
    const result = productSchema.safeParse({ sku: " ", name: "", salePrice: "" });
    expect(fieldErrors(result)).toEqual(expect.arrayContaining(["sku", "name", "salePrice"]));
  });

  it.each([
    ["SKU com espaço", { sku: "CAM 001" }, "sku"],
    ["SKU começando com hífen", { sku: "-CAM" }, "sku"],
    ["SKU com mais de 40 caracteres", { sku: "A".repeat(41) }, "sku"],
    ["preço negativo", { salePrice: "-1" }, "salePrice"],
    ["preço com 3 casas", { salePrice: "1,999" }, "salePrice"],
    ["preço que não é número", { salePrice: "abc" }, "salePrice"],
    ["estoque mínimo fracionado", { minStock: "1.5" }, "minStock"],
    ["categoria que não é uuid", { categoryId: "bebidas" }, "categoryId"],
  ])("recusa %s", (_label, override, field) => {
    const result = productSchema.safeParse({ ...valid, ...override });
    expect(result.success).toBe(false);
    expect(fieldErrors(result)).toContain(field);
  });

  it("ignora campos que a API não grava, como o saldo", () => {
    const result = productSchema.parse({ ...valid, stockQuantity: 999 });
    expect(result).not.toHaveProperty("stockQuantity");
  });
});

describe("productUpdateSchema", () => {
  it("aceita só o status, para inativar", () => {
    expect(productUpdateSchema.parse({ active: false })).toEqual({ active: false });
  });

  it("limpa a descrição quando vem vazia", () => {
    expect(productUpdateSchema.parse({ description: "" })).toEqual({ description: null });
  });

  it("recusa corpo sem nenhum campo conhecido", () => {
    expect(productUpdateSchema.safeParse({}).success).toBe(false);
    expect(productUpdateSchema.safeParse({ stockQuantity: 5 }).success).toBe(false);
  });
});

describe("productListQuerySchema", () => {
  it("usa padrões quando os filtros faltam ou são inválidos", () => {
    expect(
      productListQuerySchema.parse({ status: "xyz", page: "-3", pageSize: "1000", categoryId: "x" }),
    ).toEqual({ q: "", categoryId: undefined, status: "active", page: 1, pageSize: 20 });
  });

  it("lê os filtros da URL", () => {
    expect(productListQuerySchema.parse({ q: " cam ", status: "all", page: "2", pageSize: "50" })).toEqual(
      { q: "cam", categoryId: undefined, status: "all", page: 2, pageSize: 50 },
    );
  });
});

describe("categorySchema", () => {
  it("exige nome de até 80 caracteres", () => {
    expect(categorySchema.parse({ name: "  Bebidas " })).toEqual({ name: "Bebidas" });
    expect(categorySchema.safeParse({ name: "" }).success).toBe(false);
    expect(categorySchema.safeParse({ name: "A".repeat(81) }).success).toBe(false);
  });
});
