import { z } from "zod";

import { forgotPasswordSchema, loginSchema, resetPasswordSchema } from "@/lib/validations/auth";
import { refreshTokenSchema } from "@/lib/validations/auth-token";
import { customerListQuerySchema, customerSchema, customerUpdateSchema } from "@/lib/validations/customer";
import { dashboardQuerySchema } from "@/lib/validations/dashboard";
import { orderListQuerySchema, orderSchema, orderStatusChangeSchema } from "@/lib/validations/order";
import {
  categorySchema,
  productListQuerySchema,
  productSchema,
  productUpdateSchema,
} from "@/lib/validations/product";
import { stockMovementListQuerySchema, stockMovementSchema } from "@/lib/validations/stock";
import { userUpdateSchema } from "@/lib/validations/user";

import {
  API_SCHEMAS,
  CategorySchema,
  CurrentUserSchema,
  CustomerSchema,
  DashboardSchema,
  OkSchema,
  OrderSchema,
  OrderSummarySchema,
  ProductSchema,
  StockMovementResultSchema,
  StockMovementSchema,
  TokenSchema,
  UserSchema,
} from "./schemas";

// Especificação OpenAPI 3.1 da API v1. Corpos e filtros saem dos mesmos
// esquemas Zod que validam as requisições; as respostas, de ./schemas.

type Method = "get" | "post" | "patch";
type Access = "public" | "user" | "admin";

type Operation = {
  method: Method;
  path: string;
  tag: string;
  summary: string;
  description?: string;
  access: Access;
  query?: z.ZodObject;
  body?: z.ZodType;
  // Esquema de `data` na resposta de sucesso; `list` devolve array + paginação.
  // Sem esquema, a resposta não tem corpo (204).
  response: { status: 200 | 201 | 202 | 204; schema?: z.ZodType; list?: boolean; bare?: boolean };
  errors: number[];
};

const OPERATIONS: Operation[] = [
  // Autenticação
  {
    method: "post",
    path: "/auth/token",
    tag: "Autenticação",
    summary: "Gera um token de acesso",
    description:
      "Troca e-mail e senha por um accessToken (JWT do Supabase Auth) e um refreshToken. Não grava cookie. Usuário desativado recebe 403 `user_inactive`.",
    access: "public",
    body: loginSchema,
    response: { status: 200, schema: TokenSchema },
    errors: [400, 401, 403],
  },
  {
    method: "post",
    path: "/auth/refresh",
    tag: "Autenticação",
    summary: "Renova o token",
    description: "Troca o refreshToken por um par novo. Cada refreshToken vale uma vez.",
    access: "public",
    body: refreshTokenSchema,
    response: { status: 200, schema: TokenSchema },
    errors: [400, 401, 403],
  },
  {
    method: "post",
    path: "/auth/login",
    tag: "Autenticação",
    summary: "Login por cookie (usado pelas telas)",
    description: "Grava a sessão em cookie httpOnly. Para chamar a API de fora do app, use `/auth/token`.",
    access: "public",
    body: loginSchema,
    response: { status: 200, schema: OkSchema, bare: true },
    errors: [400, 401, 403],
  },
  {
    method: "post",
    path: "/auth/logout",
    tag: "Autenticação",
    summary: "Encerra a sessão",
    description: "Apaga a sessão do cookie ou, com token, invalida o refreshToken dele. O accessToken vale até expirar.",
    access: "public",
    response: { status: 200, schema: OkSchema, bare: true },
    errors: [],
  },
  {
    method: "post",
    path: "/auth/password/forgot",
    tag: "Autenticação",
    summary: "Pede o e-mail de recuperação de senha",
    description:
      "Responde 202 com ou sem conta para o e-mail, para não revelar quem é usuário. O link do e-mail abre a tela de nova senha do app.",
    access: "public",
    body: forgotPasswordSchema,
    response: { status: 202, schema: OkSchema, bare: true },
    errors: [400, 429],
  },
  {
    method: "post",
    path: "/auth/password/reset",
    tag: "Autenticação",
    summary: "Grava a nova senha",
    description:
      "Usa a sessão aberta pelo link de recuperação (cookie, não token) e a encerra em seguida. Link vencido → 401 `recovery_expired`.",
    access: "public",
    body: resetPasswordSchema,
    response: { status: 204 },
    errors: [400, 401, 422],
  },
  {
    method: "get",
    path: "/me",
    tag: "Autenticação",
    summary: "Usuário logado",
    access: "user",
    response: { status: 200, schema: CurrentUserSchema },
    errors: [401],
  },

  // Produtos e categorias
  {
    method: "get",
    path: "/categories",
    tag: "Produtos",
    summary: "Lista categorias",
    access: "user",
    response: { status: 200, schema: z.array(CategorySchema) },
    errors: [401],
  },
  {
    method: "post",
    path: "/categories",
    tag: "Produtos",
    summary: "Cadastra uma categoria",
    description: "Nome repetido, sem diferenciar maiúsculas, → 409 `conflict`.",
    access: "admin",
    body: categorySchema,
    response: { status: 201, schema: CategorySchema },
    errors: [400, 401, 403, 409],
  },
  {
    method: "get",
    path: "/categories/{id}",
    tag: "Produtos",
    summary: "Detalhe da categoria",
    access: "user",
    response: { status: 200, schema: CategorySchema },
    errors: [401, 404],
  },
  {
    method: "patch",
    path: "/categories/{id}",
    tag: "Produtos",
    summary: "Renomeia uma categoria",
    access: "admin",
    body: categorySchema,
    response: { status: 200, schema: CategorySchema },
    errors: [400, 401, 403, 404, 409],
  },
  {
    method: "get",
    path: "/products",
    tag: "Produtos",
    summary: "Lista produtos",
    access: "user",
    query: productListQuerySchema,
    response: { status: 200, schema: ProductSchema, list: true },
    errors: [401],
  },
  {
    method: "post",
    path: "/products",
    tag: "Produtos",
    summary: "Cadastra um produto",
    description: "O saldo começa em zero e só muda pelas movimentações de estoque. SKU repetido → 409 `conflict`.",
    access: "admin",
    body: productSchema,
    response: { status: 201, schema: ProductSchema },
    errors: [400, 401, 403, 409],
  },
  {
    method: "get",
    path: "/products/{id}",
    tag: "Produtos",
    summary: "Detalhe do produto",
    access: "user",
    response: { status: 200, schema: ProductSchema },
    errors: [401, 404],
  },
  {
    method: "patch",
    path: "/products/{id}",
    tag: "Produtos",
    summary: "Edita um produto",
    description: "Edição parcial: envie só os campos que mudam. Inativar = `{ \"active\": false }`.",
    access: "admin",
    body: productUpdateSchema,
    response: { status: 200, schema: ProductSchema },
    errors: [400, 401, 403, 404, 409],
  },

  // Estoque
  {
    method: "get",
    path: "/stock-movements",
    tag: "Estoque",
    summary: "Histórico de movimentações",
    access: "user",
    query: stockMovementListQuerySchema,
    response: { status: 200, schema: StockMovementSchema, list: true },
    errors: [401],
  },
  {
    method: "post",
    path: "/stock-movements",
    tag: "Estoque",
    summary: "Registra uma movimentação",
    description:
      "Entrada (`in`): qualquer usuário. Saída (`out`) e ajuste (`adjustment`): só administrador. Saldo insuficiente → 409 `insufficient_stock` e nada é gravado.",
    access: "user",
    body: stockMovementSchema,
    response: { status: 201, schema: StockMovementResultSchema },
    errors: [400, 401, 403, 404, 409],
  },

  // Clientes
  {
    method: "get",
    path: "/customers",
    tag: "Clientes",
    summary: "Lista clientes",
    access: "user",
    query: customerListQuerySchema,
    response: { status: 200, schema: CustomerSchema, list: true },
    errors: [401],
  },
  {
    method: "post",
    path: "/customers",
    tag: "Clientes",
    summary: "Cadastra um cliente",
    description: "CPF/CNPJ repetido → 409 `conflict`.",
    access: "user",
    body: customerSchema,
    response: { status: 201, schema: CustomerSchema },
    errors: [400, 401, 409],
  },
  {
    method: "get",
    path: "/customers/{id}",
    tag: "Clientes",
    summary: "Detalhe do cliente",
    access: "user",
    response: { status: 200, schema: CustomerSchema },
    errors: [401, 404],
  },
  {
    method: "patch",
    path: "/customers/{id}",
    tag: "Clientes",
    summary: "Edita um cliente",
    description: "Edição parcial. Inativar ou reativar (`active`) é só do administrador.",
    access: "user",
    body: customerUpdateSchema,
    response: { status: 200, schema: CustomerSchema },
    errors: [400, 401, 403, 404, 409],
  },

  // Pedidos
  {
    method: "get",
    path: "/orders",
    tag: "Pedidos",
    summary: "Lista pedidos",
    access: "user",
    query: orderListQuerySchema,
    response: { status: 200, schema: OrderSummarySchema, list: true },
    errors: [401],
  },
  {
    method: "post",
    path: "/orders",
    tag: "Pedidos",
    summary: "Cria um pedido pendente",
    description: "O preço de cada item é o preço de venda atual do produto. O estoque não muda até a confirmação.",
    access: "user",
    body: orderSchema,
    response: { status: 201, schema: OrderSchema },
    errors: [400, 401, 409],
  },
  {
    method: "get",
    path: "/orders/{id}",
    tag: "Pedidos",
    summary: "Detalhe do pedido com cliente e itens",
    access: "user",
    response: { status: 200, schema: OrderSchema },
    errors: [401, 404],
  },
  {
    method: "patch",
    path: "/orders/{id}",
    tag: "Pedidos",
    summary: "Substitui cliente, itens e observações",
    description: "Mesmo corpo da criação. Só para pedido pendente; senão → 409 `not_editable`.",
    access: "user",
    body: orderSchema,
    response: { status: 200, schema: OrderSchema },
    errors: [400, 401, 404, 409],
  },
  {
    method: "post",
    path: "/orders/{id}/status",
    tag: "Pedidos",
    summary: "Muda o status do pedido",
    description:
      "Confirmar (`confirmed`) baixa o estoque de todos os itens numa transação; se faltar saldo → 409 `insufficient_stock` e nada muda. Depois: `shipped` → `delivered`. Cancelar (`cancelled`) é só do administrador e devolve o estoque de pedido já confirmado. Transição inválida → 409 `invalid_transition`.",
    access: "user",
    body: orderStatusChangeSchema,
    response: { status: 200, schema: OrderSchema },
    errors: [400, 401, 403, 404, 409],
  },

  // Dashboard e usuários
  {
    method: "get",
    path: "/dashboard",
    tag: "Dashboard",
    summary: "Indicadores e séries dos gráficos",
    description: "`monthMargin` e `stockValue` vêm `null` para o operador.",
    access: "user",
    query: dashboardQuerySchema,
    response: { status: 200, schema: DashboardSchema },
    errors: [401],
  },
  {
    method: "get",
    path: "/users",
    tag: "Usuários",
    summary: "Lista usuários",
    access: "admin",
    response: { status: 200, schema: z.array(UserSchema) },
    errors: [401, 403],
  },
  {
    method: "patch",
    path: "/users/{id}",
    tag: "Usuários",
    summary: "Edita nome, perfil ou status",
    description: "O administrador não muda o próprio perfil nem se desativa (409 `self_change`).",
    access: "admin",
    body: userUpdateSchema,
    response: { status: 200, schema: UserSchema },
    errors: [400, 401, 403, 404, 409],
  },
];

const ERROR_DESCRIPTIONS: Record<number, string> = {
  400: "Corpo inválido (`invalid_json`, `validation_error`, `invalid_data`, `invalid_reference`)",
  401: "Sem sessão ou token (`unauthorized`, `invalid_token`, `invalid_credentials`, `invalid_refresh_token`, `recovery_expired`)",
  403: "Perfil sem permissão (`forbidden`) ou usuário desativado (`user_inactive`)",
  404: "Não encontrado (`not_found`)",
  409: "Conflito com o estado atual (`conflict`, `insufficient_stock`, `inactive_product`, `invalid_transition`, `not_editable`, `self_change`)",
  422: "Senha recusada (`same_password`, `weak_password`)",
  429: "Muitos pedidos seguidos (`too_many_requests`)",
};

const ACCESS_NOTE: Record<Access, string> = {
  public: "Acesso: público.",
  user: "Acesso: admin e operador.",
  admin: "Acesso: só administrador.",
};

// JSON Schema de um esquema Zod, sem o cabeçalho $schema e sem o regex longo
// que o Zod gera para UUID (o format já diz o que é).
function toSchema(schema: z.ZodType, io: "input" | "output") {
  const json = z.toJSONSchema(schema, {
    io,
    target: "draft-2020-12",
    unrepresentable: "any",
    reused: "inline",
    override: cleanUp,
  });
  delete json.$schema;
  return json;
}

// Tira ruído do JSON Schema gerado: o regex de UUID e os limites de
// z.int() (Number.MAX_SAFE_INTEGER), que não dizem nada a quem lê.
function cleanUp({ jsonSchema }: { jsonSchema: Record<string, unknown> }) {
  if (jsonSchema.format === "uuid") {
    delete jsonSchema.pattern;
  }
  if (jsonSchema.maximum === Number.MAX_SAFE_INTEGER) {
    delete jsonSchema.maximum;
  }
  if (jsonSchema.minimum === Number.MIN_SAFE_INTEGER) {
    delete jsonSchema.minimum;
  }
}

const COMPONENT_REF = "#/components/schemas/";

function ref(schema: z.ZodType): object {
  const id = API_SCHEMAS.get(schema)?.id;
  if (id) {
    return { $ref: `${COMPONENT_REF}${id}` };
  }
  // Lista de um componente (ex.: z.array(CategorySchema)).
  if (schema instanceof z.ZodArray) {
    return { type: "array", items: ref(schema.element as z.ZodType) };
  }
  return toSchema(schema, "output");
}

// Todos os componentes, com as referências entre eles (Product → Category).
function componentSchemas() {
  const { schemas } = z.toJSONSchema(API_SCHEMAS, {
    io: "output",
    target: "draft-2020-12",
    unrepresentable: "any",
    uri: (id) => `${COMPONENT_REF}${id}`,
    override: cleanUp,
  });
  // Sem $id: o Swagger UI não resolveria as referências.
  for (const schema of Object.values(schemas)) {
    delete schema.$schema;
    delete schema.$id;
  }
  return schemas;
}

// Filtros da URL: todos opcionais, já que valores ausentes caem no padrão.
function queryParameters(query: z.ZodObject) {
  const json = toSchema(query, "input") as { properties?: Record<string, { description?: string }> };
  return Object.entries(json.properties ?? {}).map(([name, schema]) => ({
    name,
    in: "query",
    required: false,
    schema,
  }));
}

function operationObject(op: Operation) {
  const { status, schema, list, bare } = op.response;
  const success: Record<string, unknown> = {
    description: { 201: "Criado", 202: "Aceito", 204: "Sem conteúdo" }[status as number] ?? "Sucesso",
  };
  if (schema) {
    const data = list ? { type: "array", items: ref(schema) } : ref(schema);
    const body = bare
      ? ref(schema)
      : {
          type: "object",
          properties: list
            ? { data, pagination: { $ref: "#/components/schemas/Pagination" } }
            : { data },
          required: list ? ["data", "pagination"] : ["data"],
        };
    success.content = { "application/json": { schema: body } };
  }
  if (status === 201 && op.path !== "/stock-movements") {
    success.headers = {
      Location: { description: "URL do recurso criado", schema: { type: "string" } },
    };
  }

  const pathParams = [...op.path.matchAll(/\{(\w+)\}/g)].map(([, name]) => ({
    name,
    in: "path",
    required: true,
    schema: { type: "string", format: "uuid" },
  }));

  return {
    tags: [op.tag],
    summary: op.summary,
    description: [op.description, ACCESS_NOTE[op.access]].filter(Boolean).join("\n\n"),
    operationId: `${op.method}${op.path.replace(/\{(\w+)\}/g, "By-$1").replace(/[/-](\w)/g, (_, c: string) => c.toUpperCase())}`,
    ...(op.access === "public" ? { security: [] } : {}),
    parameters: [...pathParams, ...(op.query ? queryParameters(op.query) : [])],
    ...(op.body
      ? {
          requestBody: {
            required: true,
            content: { "application/json": { schema: toSchema(op.body, "input") } },
          },
        }
      : {}),
    responses: {
      [status]: success,
      ...Object.fromEntries(
        op.errors.map((code) => [
          code,
          {
            description: ERROR_DESCRIPTIONS[code],
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        ]),
      ),
    },
  };
}

export const API_OPERATIONS = OPERATIONS.map(({ method, path, body }) => ({ method, path, body }));

export function buildOpenApiSpec() {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const op of OPERATIONS) {
    paths[op.path] ??= {};
    paths[op.path][op.method] = operationObject(op);
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "Pulse Stock API",
      version: "1.0.0",
      description: [
        "API REST do Pulse Stock, um mini ERP de estoque e pedidos de venda.",
        "**Como autenticar:** chame `POST /auth/token` com e-mail e senha, copie o `accessToken` e clique em **Authorize**. Toda rota também aceita o cookie de sessão das telas.",
        "**Convenções:** sucesso em `{ data }`; listas com `pagination`; erros em `{ error: { code, message, details? } }` no idioma do `Accept-Language` (pt, en, es). Ordenação com `sort=campo` ou `sort=-campo`. Toda resposta leva `X-Request-Id`.",
        "**Regra de negócio:** o estoque só baixa quando o pedido é confirmado.",
      ].join("\n\n"),
    },
    servers: [{ url: "/api/v1" }],
    tags: [
      { name: "Autenticação", description: "Token para clientes externos e sessão das telas" },
      { name: "Produtos", description: "Catálogo, preços e categorias" },
      { name: "Estoque", description: "Entradas, saídas, ajustes e histórico" },
      { name: "Clientes", description: "Cadastro de clientes com CPF ou CNPJ" },
      { name: "Pedidos", description: "Pedidos de venda e mudança de status" },
      { name: "Dashboard", description: "Indicadores de vendas e estoque" },
      { name: "Usuários", description: "Perfis de acesso (só administrador)" },
    ],
    security: [{ bearerAuth: [] }],
    paths,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "accessToken de POST /auth/token",
        },
      },
      schemas: componentSchemas(),
    },
  };
}
