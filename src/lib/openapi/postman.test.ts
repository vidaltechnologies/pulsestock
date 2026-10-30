import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { buildPostmanCollection, EXAMPLE_BODIES, POSTMAN_ENVIRONMENT } from "./postman";
import { API_OPERATIONS } from "./spec";

const DIR = join(process.cwd(), "postman");
const FILES = {
  collection: join(DIR, "pulse-stock.postman_collection.json"),
  environment: join(DIR, "pulse-stock.postman_environment.json"),
};

const collection = buildPostmanCollection();

const toJson = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

// `npm run postman` grava os arquivos; sem a variável, o teste só confere.
if (process.env.POSTMAN_WRITE) {
  writeFileSync(FILES.collection, toJson(collection));
  writeFileSync(FILES.environment, toJson(POSTMAN_ENVIRONMENT));
}

type Item = { name: string; item?: Item[]; request?: { method: string; url: { raw: string }; body?: { raw: string } } };

function requests(items: Item[]): Item[] {
  return items.flatMap((item) => (item.item ? requests(item.item) : [item]));
}

// Valores de mentira no lugar das variáveis do Postman, para validar os exemplos.
const SAMPLE_VALUES: Record<string, string> = {
  email: "admin@example.com",
  password: "senha-123",
  refreshToken: "refresh-token",
  runId: "TESTE",
  cpf: "52998224725",
  userFullName: "Nome do Usuário",
  newPassword: "nova-senha-123",
};

function fillVariables(raw: string) {
  return raw.replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
    name.endsWith("Id") ? "00000000-0000-4000-8000-000000000000" : SAMPLE_VALUES[name],
  );
}

describe("coleção do Postman", () => {
  it("está igual ao que a especificação gera (rode `npm run postman`)", () => {
    expect(readFileSync(FILES.collection, "utf8")).toBe(toJson(collection));
    expect(readFileSync(FILES.environment, "utf8")).toBe(toJson(POSTMAN_ENVIRONMENT));
  });

  it("tem um request para cada operação da API, e só elas", () => {
    const inCollection = requests(collection.item as Item[]).map(({ request }) => {
      const path = request!.url.raw.replace("{{baseUrl}}", "").replace(/\{\{\w+Id\}\}/, "{id}");
      return `${request!.method.toLowerCase()} ${path}`;
    });
    const inSpec = API_OPERATIONS.map(({ method, path }) => `${method} ${path}`);
    expect(inCollection.toSorted()).toEqual(inSpec.toSorted());
  });

  it("começa pelo token e termina no logout", () => {
    const all = requests(collection.item as Item[]);
    expect(all[0].request!.url.raw).toBe("{{baseUrl}}/auth/token");
    expect(all.at(-1)!.request!.url.raw).toBe("{{baseUrl}}/auth/logout");
  });

  it.each(API_OPERATIONS.filter((op) => op.body))(
    "o corpo de exemplo de $method $path passa na validação",
    ({ method, path, body }) => {
      const example = EXAMPLE_BODIES[`${method} ${path}`];
      expect(example).toBeDefined();
      expect(body!.safeParse(JSON.parse(fillVariables(JSON.stringify(example)))).error).toBeUndefined();
    },
  );

  it("o ambiente não traz senha nem token", () => {
    for (const { key, value } of POSTMAN_ENVIRONMENT.values) {
      if (key !== "baseUrl") {
        expect(value).toBe("");
      }
    }
  });
});
