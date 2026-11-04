import type { ErrorEvent } from "@sentry/nextjs";

// Opções do Sentry usadas no navegador, no servidor Node e no runtime edge.
// Sem NEXT_PUBLIC_SENTRY_DSN o SDK fica desligado (dev, testes e CI).
// Referências literais a process.env.NEXT_PUBLIC_* para o Next.js embutir no bundle.
export function getSentryOptions() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || undefined;
  const environment = process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV;
  const isProduction = process.env.NODE_ENV === "production";

  return {
    dsn,
    enabled: Boolean(dsn),
    environment,
    // Amostragem de performance: 10% em produção para caber na cota grátis.
    tracesSampleRate: parseRate(
      process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
      isProduction ? 0.1 : 1,
    ),
    // Nada de IP, cookies ou corpo da requisição por padrão.
    sendDefaultPii: false,
    beforeSend: scrubEvent,
  };
}

function parseRate(value: string | undefined, fallback: number) {
  const rate = Number(value);
  return value && Number.isFinite(rate) && rate >= 0 && rate <= 1 ? rate : fallback;
}

const SENSITIVE_HEADERS = new Set(["authorization", "cookie", "set-cookie", "x-api-key"]);
const SENSITIVE_QUERY = /([?&](?:access_token|refresh_token|token_hash|token|code|password)=)[^&#]*/gi;

// Última barreira antes do envio: tira credenciais e dados pessoais do evento.
// Só o id e o perfil do usuário seguem (veja setMonitoringUser).
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  const request = event.request;
  if (request) {
    if (request.headers) {
      request.headers = Object.fromEntries(
        Object.entries(request.headers).map(([name, value]) => [
          name,
          SENSITIVE_HEADERS.has(name.toLowerCase()) ? "[Filtered]" : value,
        ]),
      );
    }
    delete request.cookies;
    delete request.data;
    if (request.url) {
      request.url = request.url.replace(SENSITIVE_QUERY, "$1[Filtered]");
    }
    if (typeof request.query_string === "string") {
      request.query_string = `?${request.query_string}`
        .replace(SENSITIVE_QUERY, "$1[Filtered]")
        .slice(1);
    }
  }

  if (event.user) {
    event.user = { id: event.user.id, ...(event.user.role ? { role: event.user.role } : {}) };
  }

  return event;
}
