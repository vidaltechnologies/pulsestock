import * as Sentry from "@sentry/nextjs";

// Liga o Sentry no servidor (Node.js) e no runtime edge.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Exceções não tratadas em Server Components, Route Handlers, Server Actions
// e no proxy chegam aqui e vão para o Sentry com a rota e o tipo.
export const onRequestError = Sentry.captureRequestError;
