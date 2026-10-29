import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/produtos",
  "/estoque",
  "/clientes",
  "/pedidos",
  "/usuarios",
];

function isProtected(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

// Checagem otimista: redireciona quem não está logado. A autorização de fato
// acontece nas páginas, nos Route Handlers e no RLS do banco.
export async function proxy(request: NextRequest) {
  const { response, userId } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  if (!userId && isProtected(pathname)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return redirectWithCookies(loginUrl, response);
  }

  if (userId && pathname === "/login") {
    return redirectWithCookies(new URL("/dashboard", request.url), response);
  }

  return response;
}

// Mantém os cookies de sessão renovados ao trocar a resposta por um redirect.
function redirectWithCookies(url: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export const config = {
  matcher: [
    // Tudo, menos arquivos estáticos, imagens e ícones.
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
