import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, expectTypeOf, it } from "vitest";
import type { z } from "zod";

import type { CurrentUser } from "@/lib/auth";
import type { Customer } from "@/lib/data/customers";
import type { Dashboard } from "@/lib/data/dashboard";
import type { Order, OrderSummary } from "@/lib/data/orders";
import type { Category, Product } from "@/lib/data/products";
import type { StockMovement } from "@/lib/data/stock";
import type { AppUser } from "@/lib/data/users";

import * as schemas from "./schemas";
import { API_OPERATIONS, buildOpenApiSpec } from "./spec";

const API_DIR = join(process.cwd(), "src/app/api/v1");

// Rotas e métodos que existem de fato em src/app/api/v1.
function routesInCode() {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name === "route.ts") {
        const path = `/${relative(API_DIR, dir)}`.replace(/\[(\w+)\]/g, "{$1}");
        if (path === "/openapi.json") {
          continue;
        }
        const source = readFileSync(full, "utf8");
        for (const [, method] of source.matchAll(/export (?:async )?function (GET|POST|PATCH|PUT|DELETE)\b/g)) {
          found.push(`${method.toLowerCase()} ${path}`);
        }
      }
    }
  };
  walk(API_DIR);
  return found.sort();
}

describe("especificação OpenAPI", () => {
  it("documenta todas as rotas da API, e só elas", () => {
    const documented = API_OPERATIONS.map(({ method, path }) => `${method} ${path}`).sort();
    expect(documented).toEqual(routesInCode());
  });

  it("gera um documento OpenAPI 3.1 com as referências resolvíveis", () => {
    const spec = buildOpenApiSpec();
    expect(spec.openapi).toBe("3.1.0");

    const text = JSON.stringify(spec);
    const refs = new Set([...text.matchAll(/"\$ref":"#\/components\/schemas\/(\w+)"/g)].map((m) => m[1]));
    for (const name of refs) {
      expect(spec.components.schemas, name).toHaveProperty(name);
    }
    // Nenhuma referência relativa solta do Zod ($defs) nem cabeçalho $schema.
    expect(text).not.toContain("#/$defs");
    expect(text).not.toContain('"$schema"');
    expect(text).not.toContain('"$id"');
  });

  it("descreve os filtros e o corpo a partir dos esquemas de validação", () => {
    const spec = buildOpenApiSpec();
    const list = spec.paths["/products"].get as {
      parameters: { name: string; required: boolean; schema: { enum?: string[] } }[];
    };
    const sort = list.parameters.find((p) => p.name === "sort");
    expect(sort?.required).toBe(false);
    expect(sort?.schema.enum).toContain("-salePrice");
    expect(list.parameters.map((p) => p.name)).toContain("lowStock");

    const create = spec.paths["/products"].post as {
      requestBody: { content: { "application/json": { schema: { required: string[] } } } };
    };
    expect(create.requestBody.content["application/json"].schema.required).toEqual(["sku", "name", "salePrice"]);
  });
});

// Se um tipo de src/lib/data mudar, a documentação precisa mudar junto.
describe("esquemas de resposta", () => {
  it("batem com os tipos devolvidos pela API", () => {
    expectTypeOf<z.output<typeof schemas.CategorySchema>>().toEqualTypeOf<Category>();
    expectTypeOf<z.output<typeof schemas.ProductSchema>>().toEqualTypeOf<Product>();
    expectTypeOf<z.output<typeof schemas.StockMovementSchema>>().toEqualTypeOf<StockMovement>();
    expectTypeOf<z.output<typeof schemas.CustomerSchema>>().toEqualTypeOf<Customer>();
    expectTypeOf<z.output<typeof schemas.OrderSummarySchema>>().toEqualTypeOf<OrderSummary>();
    // Order é uma interseção de tipos: basta ser compatível nos dois sentidos.
    expectTypeOf<z.output<typeof schemas.OrderSchema>>().toExtend<Order>();
    expectTypeOf<Order>().toExtend<z.output<typeof schemas.OrderSchema>>();
    expectTypeOf<z.output<typeof schemas.DashboardSchema>>().toEqualTypeOf<Dashboard>();
    expectTypeOf<z.output<typeof schemas.CurrentUserSchema>>().toEqualTypeOf<CurrentUser>();
    expectTypeOf<z.output<typeof schemas.UserSchema>>().toEqualTypeOf<AppUser>();
  });
});
