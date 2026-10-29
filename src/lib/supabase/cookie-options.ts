import type { CookieOptionsWithName } from "@supabase/ssr";

// A sessão só é lida no servidor (proxy, Server Components e Route Handlers),
// então os cookies podem ser httpOnly: scripts no navegador não leem o token.
export const SUPABASE_COOKIE_OPTIONS: CookieOptionsWithName = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
};
