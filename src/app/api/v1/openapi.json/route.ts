import { NextResponse } from "next/server";

import { buildOpenApiSpec } from "@/lib/openapi/spec";

// Especificação OpenAPI 3.1 da API, pública. É a fonte da página /api/docs e
// pode ser importada no Postman.
export function GET() {
  return NextResponse.json(buildOpenApiSpec(), {
    headers: { "Access-Control-Allow-Origin": "*" },
  });
}
