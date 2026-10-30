import { describe, expect, it } from "vitest";

import { parseSort, sortSchema } from "./sort";

describe("sortSchema", () => {
  const schema = sortSchema(["name", "createdAt"], "name");

  it("aceita os campos permitidos, crescente ou decrescente", () => {
    expect(schema.parse("createdAt")).toBe("createdAt");
    expect(schema.parse("-name")).toBe("-name");
  });

  it("cai no padrão com campo desconhecido ou ausente", () => {
    expect(schema.parse("price")).toBe("name");
    expect(schema.parse("--name")).toBe("name");
    expect(schema.parse(undefined)).toBe("name");
  });
});

describe("parseSort", () => {
  it("separa o campo e a direção", () => {
    expect(parseSort("name")).toEqual({ field: "name", ascending: true });
    expect(parseSort("-createdAt")).toEqual({ field: "createdAt", ascending: false });
  });
});
