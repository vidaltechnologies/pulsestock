import { describe, expect, it } from "vitest";

import {
  customerListQuerySchema,
  customerSchema,
  customerUpdateSchema,
  formatDocument,
  isValidDocument,
} from "./customer";

function fields(result: { error?: { issues: { path: PropertyKey[] }[] } }) {
  return result.error?.issues.map((issue) => issue.path.join(".")) ?? [];
}

describe("isValidDocument", () => {
  it.each(["52998224725", "11144477735", "11222333000181", "45723174000110"])("aceita %s", (doc) => {
    expect(isValidDocument(doc)).toBe(true);
  });

  it.each([
    ["CPF com dígito errado", "52998224724"],
    ["CPF repetido", "11111111111"],
    ["CNPJ com dígito errado", "11222333000182"],
    ["CNPJ repetido", "00000000000000"],
    ["tamanho errado", "123456789"],
  ])("recusa %s", (_label, doc) => {
    expect(isValidDocument(doc)).toBe(false);
  });
});

describe("formatDocument", () => {
  it("aplica a máscara de CPF e CNPJ", () => {
    expect(formatDocument("52998224725")).toBe("529.982.247-25");
    expect(formatDocument("11222333000181")).toBe("11.222.333/0001-81");
  });
});

describe("customerSchema", () => {
  it("normaliza o formulário", () => {
    expect(
      customerSchema.parse({
        name: "  Maria Souza ",
        document: "529.982.247-25",
        email: " Maria@Exemplo.com ",
        phone: "",
        city: "Recife",
        state: "pe",
      }),
    ).toEqual({
      name: "Maria Souza",
      document: "52998224725",
      email: "maria@exemplo.com",
      phone: null,
      city: "Recife",
      state: "PE",
      active: true,
    });
  });

  it("aceita só o nome", () => {
    expect(customerSchema.parse({ name: "Loja X", document: "", state: "" })).toMatchObject({
      document: null,
      state: null,
    });
  });

  it.each([
    ["nome vazio", { name: " " }, "name"],
    ["CPF inválido", { document: "529.982.247-24" }, "document"],
    ["documento curto", { document: "1234" }, "document"],
    ["e-mail inválido", { email: "maria@" }, "email"],
    ["UF inexistente", { state: "XX" }, "state"],
    ["telefone longo", { phone: "1".repeat(21) }, "phone"],
  ])("recusa %s", (_label, override, field) => {
    const result = customerSchema.safeParse({ name: "Maria", ...override });
    expect(result.success).toBe(false);
    expect(fields(result)).toContain(field);
  });
});

describe("customerUpdateSchema", () => {
  it("aceita só o status", () => {
    expect(customerUpdateSchema.parse({ active: false })).toEqual({ active: false });
  });

  it("recusa corpo vazio", () => {
    expect(customerUpdateSchema.safeParse({}).success).toBe(false);
  });
});

describe("customerListQuerySchema", () => {
  it("usa padrões para filtros inválidos", () => {
    expect(customerListQuerySchema.parse({ status: "x", page: "abc", sort: "city" })).toEqual({
      q: "",
      status: "active",
      sort: "name",
      page: 1,
      pageSize: 20,
    });
  });
});
