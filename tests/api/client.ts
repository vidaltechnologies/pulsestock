// Cliente mínimo para os testes de integração: chama a API v1 do app em
// execução e devolve status, cabeçalhos e corpo já lido.

const BASE_URL = process.env.API_TEST_BASE_URL ?? "http://localhost:3100";

// Os testes criam produtos, clientes e pedidos. Só rodam contra o app local,
// a não ser que alguém libere de propósito.
const { hostname } = new URL(BASE_URL);
if (!["localhost", "127.0.0.1"].includes(hostname) && process.env.API_TEST_ALLOW_REMOTE !== "1") {
  throw new Error(`Os testes da API só rodam contra o app local, não contra ${BASE_URL}.`);
}

export type ApiResponse<T = unknown> = {
  status: number;
  headers: Headers;
  body: T;
};

type Options = {
  method?: "GET" | "POST" | "PATCH";
  token?: string;
  body?: unknown;
  headers?: Record<string, string>;
};

// Corpo de erro padrão da API.
export type ApiError = { error: { code: string; message: string; details?: Record<string, string[]> } };

// Nos testes o corpo é lido como JSON solto; cada teste confere o formato.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

export async function api<T = Json>(path: string, options: Options = {}): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = { ...options.headers };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${BASE_URL}/api/v1${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  return { status: response.status, headers: response.headers, body: text ? JSON.parse(text) : null };
}

function credential(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Defina ${name} (rode npm run test:api:setup).`);
  }
  return value;
}

export const ADMIN = {
  email: credential("API_TEST_ADMIN_EMAIL"),
  password: credential("API_TEST_PASSWORD"),
};
export const OPERATOR = {
  email: credential("API_TEST_OPERATOR_EMAIL"),
  password: credential("API_TEST_PASSWORD"),
};

export async function login(user: { email: string; password: string }) {
  const response = await api("/auth/token", { method: "POST", body: user });
  if (response.status !== 200) {
    throw new Error(`Login de ${user.email} falhou: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return response.body.data as { accessToken: string; refreshToken: string };
}

// Sufixo para nomes e SKUs únicos a cada execução.
export const RUN = Date.now().toString(36).toUpperCase();
