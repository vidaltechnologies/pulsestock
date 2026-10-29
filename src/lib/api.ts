import { NextResponse } from "next/server";
import { z } from "zod";

import { translateMessage } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

// As mensagens são escritas em português e saem no idioma de quem chamou
// (cookie do seletor ou Accept-Language), assim como os erros por campo.
export async function apiError(
  status: number,
  code: string,
  message: string,
  details?: unknown,
) {
  const locale = await getLocale();
  return NextResponse.json<ApiErrorBody>(
    {
      error: {
        code,
        message: translateMessage(message, locale),
        ...(details === undefined ? {} : { details: translateDetails(details, locale) }),
      },
    },
    { status },
  );
}

// Erros por campo do Zod: { campo: ["mensagem", ...] }.
function translateDetails(details: unknown, locale: Locale): unknown {
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    return details;
  }
  return Object.fromEntries(
    Object.entries(details).map(([field, messages]) => [
      field,
      Array.isArray(messages)
        ? messages.map((m) => (typeof m === "string" ? translateMessage(m, locale) : m))
        : messages,
    ]),
  );
}

// Lê o corpo JSON e valida com Zod. Devolve os dados ou a resposta de erro 400.
export async function parseJsonBody<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<
  { data: z.infer<T>; error?: never } | { data?: never; error: NextResponse }
> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      error: await apiError(400, "invalid_json", "O corpo da requisição não é um JSON válido."),
    };
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      error: await apiError(
        400,
        "validation_error",
        "Dados inválidos.",
        z.flattenError(result.error).fieldErrors,
      ),
    };
  }

  return { data: result.data };
}
