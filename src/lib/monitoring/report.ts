import * as Sentry from "@sentry/nextjs";

type ReportContext = {
  // Onde aconteceu, ex.: "supabase", "auth.password.reset".
  source: string;
  // Código do erro na origem (Postgres, Supabase Auth...).
  code?: string;
  level?: "error" | "warning";
  extra?: Record<string, unknown>;
};

// Erros tratados (que viram resposta 5xx em vez de exceção) não passam pelo
// onRequestError do Next.js, então são enviados ao Sentry por aqui. Continua
// escrevendo no console para os logs do servidor.
export function reportError(error: unknown, { source, code, level = "error", extra }: ReportContext) {
  const exception = toError(error);
  const log = level === "warning" ? console.warn : console.error;
  log(`[${source}]`, code ?? "", exception.message);

  Sentry.captureException(exception, {
    level,
    tags: { source, ...(code ? { error_code: code } : {}) },
    extra,
  });
}

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  // Erros do Supabase chegam como objeto simples { code, message }.
  if (error && typeof error === "object" && "message" in error) {
    const wrapped = new Error(String(error.message));
    if ("name" in error && typeof error.name === "string") {
      wrapped.name = error.name;
    }
    return wrapped;
  }
  return new Error(String(error));
}

// Só o id e o perfil vão para o Sentry; e-mail e nome ficam de fora.
export function setMonitoringUser(user: { id: string; role: string } | null) {
  Sentry.setUser(user ? { id: user.id, role: user.role } : null);
}
