import { buildOpenApiSpec } from "./spec";

// Coleção do Postman (formato v2.1) montada a partir da especificação OpenAPI:
// uma pasta por tag, um request por operação, com corpo de exemplo e teste do
// status de sucesso. Gravada em postman/ por `npm run postman`.

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
export const EXAMPLE_BODIES: Record<string, unknown> = {
  "post /auth/token": { email: "{{email}}", password: "{{password}}" },
  "post /auth/refresh": { refreshToken: "{{refreshToken}}" },
  "post /auth/login": { email: "{{email}}", password: "{{password}}" },
  "post /auth/password/forgot": { email: "{{email}}" },
  "post /auth/password/reset": { password: "{{newPassword}}" },
  "post /categories": { name: "Categoria {{runId}}" },
  "patch /categories/{id}": { name: "Categoria {{runId}}" },
  "post /products": {
    sku: "API-{{runId}}",
    name: "Produto criado pela API",
    description: "Cadastrado pela coleção do Postman.",
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
    reason: "Entrada pela API",
  },
  "post /customers": {
    name: "Cliente {{runId}}",
    document: "{{cpf}}",
    email: "cliente@example.com",
    phone: "(11) 3333-4444",
    city: "São Paulo",
    state: "SP",
  },
  "patch /customers/{id}": { phone: "(11) 98888-7777" },
  "post /orders": {
    customerId: "{{customerId}}",
    notes: "Pedido criado pela API",
    items: [{ productId: "{{productId}}", quantity: 2 }],
  },
  "patch /orders/{id}": {
    customerId: "{{customerId}}",
    notes: "Pedido editado pela API",
    items: [{ productId: "{{productId}}", quantity: 3 }],
  },
  "post /orders/{id}/status": { status: "confirmed" },
  // Repete o próprio nome: a coleção não muda nada de verdade no usuário.
  "patch /users/{id}": { fullName: "{{userFullName}}" },
};

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

// Status aceitos além do de sucesso, para o Collection Runner não acusar
// falha onde o resultado depende de algo fora da coleção.
const ALSO_ACCEPTED: Record<string, { statuses: number[]; why: string }> = {
  "post /auth/password/forgot": { statuses: [429], why: "429 se o Supabase limitar os e-mails" },
};

// Scripts antes de requests específicos. A troca de senha vale para qualquer
// sessão aberta (até o cookie do login por cookie), então só roda quando a
// pessoa preenche newPassword no ambiente; no Collection Runner, fica de fora.
const ITEM_PRE_REQUEST: Record<string, string[]> = {
  "post /auth/password/reset": [
    "// Só troca a senha se newPassword estiver preenchido no ambiente.",
    "if (!pm.variables.get('newPassword')) {",
    "  console.log('Troca de senha pulada: preencha newPassword no ambiente para usar.');",
    "  pm.execution.skipRequest();",
    "}",
  ],
};

// Fica por último: invalida o refreshToken da sessão.
const LAST = "post /auth/logout";

// Script da coleção, antes de cada request: valores únicos para os exemplos.
const PRE_REQUEST = [
  "// Sufixo único para SKU e nomes, e um CPF válido novo, a cada request.",
  "pm.variables.set('runId', Date.now().toString(36).toUpperCase());",
  "const digits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));",
  "for (const length of [9, 10]) {",
  "  const sum = digits.reduce((total, digit, i) => total + digit * (length + 1 - i), 0);",
  "  digits.push(((sum * 10) % 11) % 10);",
  "}",
  "pm.variables.set('cpf', digits.join(''));",
];

function testScript(key: string, status: number) {
  const extra = ALSO_ACCEPTED[key];
  const lines = extra
    ? [
        `pm.test('Status ${status} (ou ${extra.why})', () => {`,
        `  pm.expect(pm.response.code).to.be.oneOf(${JSON.stringify([status, ...extra.statuses])});`,
        "});",
      ]
    : [`pm.test('Status ${status}', () => pm.response.to.have.status(${status}));`];

  const saves = SAVES[key];
  if (saves) {
    lines.push(
      "",
      "// Guarda no ambiente (ou na coleção, sem ambiente) para os próximos requests.",
      "const store = pm.environment.name ? pm.environment : pm.collectionVariables;",
      "if (pm.response.code === " + status + ") {",
      "  const body = pm.response.json();",
      ...Object.entries(saves).map(([name, path]) => `  store.set('${name}', body.${path});`),
      "}",
    );
  }
  return lines;
}

function requestItem(method: string, path: string, op: SpecOperation) {
  const key = `${method} ${path}`;
  const status = Number(Object.keys(op.responses)[0]);
  const [, resource] = path.split("/");
  const urlPath = path.replace(/\{id\}/, `{{${ID_VARIABLES[resource]}}}`);

  // Filtros vêm desligados, com o valor padrão (ou o primeiro possível).
  const query = op.parameters
    .filter((p) => p.in === "query")
    .map((p) => ({
      key: p.name,
      value: String(p.schema.default ?? p.schema.enum?.[0] ?? ""),
      disabled: true,
    }));

  const body = EXAMPLE_BODIES[key];
  return {
    name: op.summary,
    event: [
      ...(ITEM_PRE_REQUEST[key]
        ? [{ listen: "prerequest", script: { type: "text/javascript", exec: ITEM_PRE_REQUEST[key] } }]
        : []),
      { listen: "test", script: { type: "text/javascript", exec: testScript(key, status) } },
    ],
    request: {
      method: method.toUpperCase(),
      description: op.description,
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

export function buildPostmanCollection() {
  const spec = buildOpenApiSpec();
  const paths = spec.paths as Record<string, Record<string, SpecOperation>>;

  const folders = spec.tags.map((tag) => ({
    name: tag.name,
    description: tag.description,
    item: [] as ReturnType<typeof requestItem>[],
  }));
  let last: ReturnType<typeof requestItem> | undefined;

  for (const [path, methods] of Object.entries(paths)) {
    for (const [method, op] of Object.entries(methods)) {
      const item = requestItem(method, path, op);
      if (`${method} ${path}` === LAST) {
        last = item;
      } else {
        folders.find((folder) => folder.name === op.tags[0])!.item.push(item);
      }
    }
  }

  return {
    info: {
      name: spec.info.title,
      description: [
        spec.info.description,
        "**Para começar:** escolha o ambiente *Pulse Stock (local)*, preencha `email` e `password` e rode **Gera um token de acesso**. O token fica salvo e vale para os outros requests. A coleção inteira roda no Collection Runner, na ordem das pastas.",
      ].join("\n\n"),
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    auth: { type: "bearer", bearer: [{ key: "token", value: "{{accessToken}}", type: "string" }] },
    event: [{ listen: "prerequest", script: { type: "text/javascript", exec: PRE_REQUEST } }],
    variable: Object.values(ID_VARIABLES)
      .concat("userFullName")
      .map((key) => ({ key, value: "" })),
    item: [
      ...folders,
      {
        name: "Sair",
        description: "Fica por último porque invalida o refreshToken. O accessToken vale até expirar.",
        item: last ? [last] : [],
      },
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
