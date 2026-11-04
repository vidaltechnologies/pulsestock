"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// Último recurso quando o próprio layout raiz quebra. Fica fora do
// I18nProvider, então o texto vai nos três idiomas.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          margin: 0,
          color: "#0F172A",
        }}
      >
        <main style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>Algo deu errado</h1>
          <p style={{ margin: 0, color: "#475569" }}>
            Something went wrong · Algo salió mal
          </p>
          <p style={{ color: "#475569" }}>
            O erro foi registrado. Tente de novo em instantes.
          </p>
          {error.digest ? (
            <p style={{ fontSize: 12, color: "#94A3B8" }}>Código: {error.digest}</p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 8,
              padding: "8px 16px",
              border: 0,
              borderRadius: 8,
              background: "#0B6CFF",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Tentar de novo · Try again · Reintentar
          </button>
        </main>
      </body>
    </html>
  );
}
