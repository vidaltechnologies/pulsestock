import { describe, expect, it } from "vitest";

import { userUpdateSchema } from "./user";

describe("userUpdateSchema", () => {
  it("aceita perfil, status e nome", () => {
    expect(userUpdateSchema.parse({ role: "admin" })).toEqual({ role: "admin" });
    expect(userUpdateSchema.parse({ active: false })).toEqual({ active: false });
    expect(userUpdateSchema.parse({ fullName: "  Ana Souza " })).toEqual({ fullName: "Ana Souza" });
  });

  it("recusa corpo vazio, perfil desconhecido e nome em branco", () => {
    expect(userUpdateSchema.safeParse({}).success).toBe(false);
    expect(userUpdateSchema.safeParse({ role: "superuser" }).success).toBe(false);
    expect(userUpdateSchema.safeParse({ fullName: "   " }).success).toBe(false);
    expect(userUpdateSchema.safeParse({ active: "false" }).success).toBe(false);
  });
});
