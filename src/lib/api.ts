import { NextResponse } from "next/server";
import { z } from "zod";

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export function apiError(
  status: number,
  code: string,
  message: string,
  details?: unknown,
) {
  return NextResponse.json<ApiErrorBody>(
    { error: { code, message, ...(details === undefined ? {} : { details }) } },
    { status },
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
      error: apiError(400, "invalid_json", "O corpo da requisição não é um JSON válido."),
    };
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      error: apiError(
        400,
        "validation_error",
        "Dados inválidos.",
        z.flattenError(result.error).fieldErrors,
      ),
    };
  }

  return { data: result.data };
}
