import "server-only";

import { cookies, headers } from "next/headers";
import { cache } from "react";

import { getFormat } from "@/lib/format";
import { getDictionary, translateMessage } from "@/lib/i18n";
import { isLocale, LOCALE_COOKIE, localeFromAcceptLanguage, type Locale } from "@/lib/i18n/config";

// Idioma da requisição: o escolhido no seletor (cookie) ou, na primeira
// visita, o do navegador. Lê a requisição, então quem usa fica atrás de
// <Suspense> (Cache Components); o layout raiz já tem um.
export const getLocale = cache(async (): Promise<Locale> => {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(chosen)) {
    return chosen;
  }
  return localeFromAcceptLanguage((await headers()).get("accept-language"));
});

export async function getI18n() {
  const locale = await getLocale();
  return {
    locale,
    t: getDictionary(locale),
    f: getFormat(locale),
    tm: (message: string) => translateMessage(message, locale),
  };
}
