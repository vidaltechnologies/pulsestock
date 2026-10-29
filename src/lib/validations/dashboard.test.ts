import { describe, expect, it } from "vitest";

import { dashboardQuerySchema } from "./dashboard";

describe("dashboardQuerySchema", () => {
  it("aceita os períodos da lista", () => {
    expect(dashboardQuerySchema.parse({ days: "7" }).days).toBe(7);
    expect(dashboardQuerySchema.parse({ days: "90" }).days).toBe(90);
  });

  it("cai em 30 dias quando o período é inválido ou ausente", () => {
    expect(dashboardQuerySchema.parse({}).days).toBe(30);
    expect(dashboardQuerySchema.parse({ days: "15" }).days).toBe(30);
    expect(dashboardQuerySchema.parse({ days: "abc" }).days).toBe(30);
  });
});
