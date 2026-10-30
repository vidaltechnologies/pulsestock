import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { buildPostmanCollection, exampleBodies, POSTMAN_ENVIRONMENT } from "./postman";
import { POSTMAN_LANGUAGES, POSTMAN_TEXTS } from "./postman-i18n";
import { API_OPERATIONS, buildOpenApiSpec } from "./spec";

const DIR = join(process.cwd(), "postman");
const ENVIRONMENT_FILE = join(DIR, "pulse-stock.postman_environment.json");
const collectionFile = (language: string) => join(DIR, `pulse-stock.${language}.postman_collection.json`);

const toJson = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

// `npm run postman` grava os arquivos; sem a variável, o teste só confere.
if (process.env.POSTMAN_WRITE) {
  for (const language of POSTMAN_LANGUAGES) {
    writeFileSync(collectionFile(language), toJson(buildPostmanCollection(language)));
  }
  writeFileSync(ENVIRONMENT_FILE, toJson(POSTMAN_ENVIRONMENT));
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

const operationKeys = API_OPERATIONS.map(({ method, path }) => `${method} ${path}`);

describe.each(POSTMAN_LANGUAGES)("coleção do Postman (%s)", (language) => {
  const collection = buildPostmanCollection(language);

  it("está igual ao que a especificação gera (rode `npm run postman`)", () => {
    expect(readFileSync(collectionFile(language), "utf8")).toBe(toJson(collection));
  });

  it("tem um request para cada operação da API, e só elas", () => {
    const inCollection = requests(collection.item as Item[]).map(({ request }) => {
      const path = request!.url.raw.replace("{{baseUrl}}", "").replace(/\{\{\w+Id\}\}/, "{id}");
      return `${request!.method.toLowerCase()} ${path}`;
    });
    expect(inCollection.toSorted()).toEqual(operationKeys.toSorted());
  });

  it("começa pelo token e termina no logout", () => {
    const all = requests(collection.item as Item[]);
    expect(all[0].request!.url.raw).toBe("{{baseUrl}}/auth/token");
    expect(all.at(-1)!.request!.url.raw).toBe("{{baseUrl}}/auth/logout");
  });

  it.each(API_OPERATIONS.filter((op) => op.body))(
    "o corpo de exemplo de $method $path passa na validação",
    ({ method, path, body }) => {
      const example = exampleBodies(language)[`${method} ${path}`];
      expect(example).toBeDefined();
      expect(body!.safeParse(JSON.parse(fillVariables(JSON.stringify(example)))).error).toBeUndefined();
    },
  );
});

describe.each(["en", "es"] as const)("traduções da coleção (%s)", (language) => {
  const texts = POSTMAN_TEXTS[language];

  it("traduzem toda operação e toda pasta da especificação, e só elas", () => {
    expect(Object.keys(texts.operations).toSorted()).toEqual(operationKeys.toSorted());
    expect(Object.keys(texts.tags).toSorted()).toEqual(buildOpenApiSpec().tags.map((tag) => tag.name).toSorted());
  });
});

it("o ambiente não traz senha nem token", () => {
  for (const { key, value } of POSTMAN_ENVIRONMENT.values) {
    if (key !== "baseUrl") {
      expect(value).toBe("");
    }
  }
});
