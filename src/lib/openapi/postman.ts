import { type Language, POSTMAN_TEXTS } from "./postman-i18n";
import { API_OPERATIONS, buildOpenApiSpec } from "./spec";

// Coleção do Postman (formato v2.1) montada a partir da especificação OpenAPI:
// uma pasta por tag, um request por operação, com corpo de exemplo e teste do
// status de sucesso, em português, inglês ou espanhol. Gravada em postman/
// por `npm run postman`.

type SpecOperation = {
  tags: string[];
  summary: string;
  description: string;
  security?: unknown[];
  parameters: { name: string; in: string; schema: { default?: unknown; enum?: unknown[] } }[];
  responses: Record<string, unknown>;
};

// Corpo de exemplo de cada operação com corpo. {{...}} são variáveis do
// Postman: as de ambiente (email, password) e as que os próprios requests
// gravam (categoryId, productId...). runId e cpf mudam a cada request, para
// a coleção rodar várias vezes sem bater em SKU, nome ou CPF repetido.
export function exampleBodies(language: Language): Record<string, unknown> {
  const text = POSTMAN_TEXTS[language].examples;
  return {
    "post /auth/token": { email: "{{email}}", password: "{{password}}" },
    "post /auth/refresh": { refreshToken: "{{refreshToken}}" },
    "post /auth/login": { email: "{{email}}", password: "{{password}}" },
    "post /auth/password/forgot": { email: "{{email}}" },
    "post /auth/password/reset": { password: "{{newPassword}}" },
    "post /categories": { name: `${text.category} {{runId}}` },
    "patch /categories/{id}": { name: `${text.category} {{runId}}` },
    "post /products": {
      sku: "API-{{runId}}",
      name: text.product,
      description: text.productDescription,
      categoryId: "{{categoryId}}",
      unit: "UN",
      costPrice: 12.5,
      salePrice: 29.9,
      minStock: 5,
    },
    "patch /products/{id}": { salePrice: 34.9 },
    "post /stock-movements": {
      productId: "{{productId}}",
      type: "in",
      quantity: 20,
      reason: text.stockReason,
    },
    "post /customers": {
      name: `${text.customer} {{runId}}`,
      document: "{{cpf}}",
      email: "cliente@example.com",
      phone: "(11) 3333-4444",
      city: "São Paulo",
      state: "SP",
    },
    "patch /customers/{id}": { phone: "(11) 98888-7777" },
    "post /orders": {
      customerId: "{{customerId}}",
      notes: text.orderNotes,
      items: [{ productId: "{{productId}}", quantity: 2 }],
    },
    "patch /orders/{id}": {
      customerId: "{{customerId}}",
      notes: text.orderEdited,
      items: [{ productId: "{{productId}}", quantity: 3 }],
    },
    "post /orders/{id}/status": { status: "confirmed" },
    // Repete o próprio nome: a coleção não muda nada de verdade no usuário.
    "patch /users/{id}": { fullName: "{{userFullName}}" },
  };
}

// Variável usada no lugar de {id}, pelo primeiro trecho do caminho.
const ID_VARIABLES: Record<string, string> = {
  categories: "categoryId",
  products: "productId",
  customers: "customerId",
  orders: "orderId",
  users: "userId",
};

// Requests que gravam variáveis para os seguintes: caminho do valor na resposta.
const SAVES: Record<string, Record<string, string>> = {
  "post /auth/token": { accessToken: "data.accessToken", refreshToken: "data.refreshToken" },
  "post /auth/refresh": { accessToken: "data.accessToken", refreshToken: "data.refreshToken" },
  "get /me": { userId: "data.id", userFullName: "data.fullName" },
  "post /categories": { categoryId: "data.id" },
  "post /products": { productId: "data.id" },
  "post /customers": { customerId: "data.id" },
  "post /orders": { orderId: "data.id" },
};

// Pede o e-mail de recuperação: aceita também 429, para o Collection Runner
// não acusar falha quando o Supabase limita os e-mails.
const RATE_LIMITED = "post /auth/password/forgot";

// A troca de senha vale para qualquer sessão aberta (até o cookie do login
// por cookie), então só roda quando a pessoa preenche newPassword no
// ambiente; no Collection Runner, fica de fora.
const RESET = "post /auth/password/reset";

// Fica por último: invalida o refreshToken da sessão.
const LAST = "post /auth/logout";

const script = (listen: "prerequest" | "test", exec: string[]) => ({
  listen,
  script: { type: "text/javascript", exec },
});

// Script da coleção, antes de cada request: idioma dos erros e valores
// únicos para os exemplos.
function collectionPreRequest(language: Language) {
  const { comments } = POSTMAN_TEXTS[language];
  return [
    `// ${comments.language}`,
    `pm.request.headers.upsert({ key: 'Accept-Language', value: '${language}' });`,
    "",
    `// ${comments.unique}`,
    "pm.variables.set('runId', Date.now().toString(36).toUpperCase());",
    "const digits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));",
    "for (const length of [9, 10]) {",
    "  const sum = digits.reduce((total, digit, i) => total + digit * (length + 1 - i), 0);",
    "  digits.push(((sum * 10) % 11) % 10);",
    "}",
    "pm.variables.set('cpf', digits.join(''));",
  ];
}

function testScript(key: string, status: number, language: Language) {
  const texts = POSTMAN_TEXTS[language];
  const lines =
    key === RATE_LIMITED
      ? [
          `pm.test('Status ${status} (${texts.orRateLimited})', () => {`,
          `  pm.expect(pm.response.code).to.be.oneOf([${status}, 429]);`,
          "});",
        ]
      : [`pm.test('Status ${status}', () => pm.response.to.have.status(${status}));`];

  const saves = SAVES[key];
  if (saves) {
    lines.push(
      "",
      `// ${texts.comments.store}`,
      "const store = pm.environment.name ? pm.environment : pm.collectionVariables;",
      `if (pm.response.code === ${status}) {`,
      "  const body = pm.response.json();",
      ...Object.entries(saves).map(([name, path]) => `  store.set('${name}', body.${path});`),
      "}",
    );
  }
  return lines;
}

function resetPreRequest(language: Language) {
  const texts = POSTMAN_TEXTS[language];
  return [
    `// ${texts.comments.resetOnly}`,
    "if (!pm.variables.get('newPassword')) {",
    `  console.log('${texts.skipReset}');`,
    "  pm.execution.skipRequest();",
    "}",
  ];
}

const ACCESS = Object.fromEntries(API_OPERATIONS.map((op) => [`${op.method} ${op.path}`, op.access]));

// Nome e descrição do request: em português, os da especificação.
function describe(key: string, op: SpecOperation, language: Language) {
  if (language === "pt") {
    return { name: op.summary, description: op.description };
  }
  const texts = POSTMAN_TEXTS[language];
  const { summary, description } = texts.operations[key];
  return {
    name: summary,
    description: [description, texts.access[ACCESS[key]]].filter(Boolean).join("\n\n"),
  };
}

function requestItem(method: string, path: string, op: SpecOperation, language: Language) {
  const key = `${method} ${path}`;
  const status = Number(Object.keys(op.responses)[0]);
  const [, resource] = path.split("/");
  const urlPath = path.replace(/\{id\}/, `{{${ID_VARIABLES[resource]}}}`);
  const { name, description } = describe(key, op, language);

  // Filtros vêm desligados, com o valor padrão (ou o primeiro possível).
  const query = op.parameters
    .filter((p) => p.in === "query")
    .map((p) => ({
      key: p.name,
      value: String(p.schema.default ?? p.schema.enum?.[0] ?? ""),
      disabled: true,
    }));

  const body = exampleBodies(language)[key];
  return {
    name,
    event: [
      ...(key === RESET ? [script("prerequest", resetPreRequest(language))] : []),
      script("test", testScript(key, status, language)),
    ],
    request: {
      method: method.toUpperCase(),
      description,
      // Rotas públicas vão sem token, menos o logout, que usa o token para encerrar a sessão.
      ...(op.security && key !== LAST ? { auth: { type: "noauth" } } : {}),
      header: body ? [{ key: "Content-Type", value: "application/json" }] : [],
      ...(body
        ? {
            body: {
              mode: "raw",
              raw: JSON.stringify(body, null, 2),
              options: { raw: { language: "json" } },
            },
          }
        : {}),
      url: {
        raw: `{{baseUrl}}${urlPath}`,
        host: ["{{baseUrl}}"],
        path: urlPath.split("/").filter(Boolean),
        ...(query.length ? { query } : {}),
      },
    },
  };
}

export function buildPostmanCollection(language: Language) {
  const spec = buildOpenApiSpec();
  const paths = spec.paths as Record<string, Record<string, SpecOperation>>;
  const texts = POSTMAN_TEXTS[language];

  const folders = spec.tags.map((tag) => ({
    tag: tag.name,
    name: texts.tags[tag.name]?.name ?? tag.name,
    description: texts.tags[tag.name]?.description ?? tag.description,
    item: [] as ReturnType<typeof requestItem>[],
  }));
  let last: ReturnType<typeof requestItem> | undefined;

  for (const [path, methods] of Object.entries(paths)) {
    for (const [method, op] of Object.entries(methods)) {
      const item = requestItem(method, path, op, language);
      if (`${method} ${path}` === LAST) {
        last = item;
      } else {
        folders.find((folder) => folder.tag === op.tags[0])!.item.push(item);
      }
    }
  }

  // Na descrição da coleção, o parágrafo de autenticação do Swagger
  // (botão Authorize) não se aplica; o "Para começar" ocupa o lugar dele.
  const intro = language === "pt" ? spec.info.description.split("\n\n").filter((p) => !p.includes("Authorize")) : texts.intro;

  return {
    info: {
      name: `${spec.info.title} (${texts.label})`,
      description: [intro[0], texts.start, ...intro.slice(1)].join("\n\n"),
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    auth: { type: "bearer", bearer: [{ key: "token", value: "{{accessToken}}", type: "string" }] },
    event: [script("prerequest", collectionPreRequest(language))],
    variable: Object.values(ID_VARIABLES)
      .concat("userFullName")
      .map((key) => ({ key, value: "" })),
    item: [
      ...folders.map(({ name, description, item }) => ({ name, description, item })),
      { ...texts.logoutFolder, item: last ? [last] : [] },
    ],
  };
}

export const POSTMAN_ENVIRONMENT = {
  name: "Pulse Stock (local)",
  values: [
    { key: "baseUrl", value: "http://localhost:3000/api/v1", type: "default", enabled: true },
    { key: "email", value: "", type: "default", enabled: true },
    { key: "password", value: "", type: "secret", enabled: true },
    { key: "accessToken", value: "", type: "secret", enabled: true },
    { key: "refreshToken", value: "", type: "secret", enabled: true },
    { key: "newPassword", value: "", type: "secret", enabled: true },
  ],
  _postman_variable_scope: "environment",
};
