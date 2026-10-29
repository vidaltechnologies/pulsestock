"use client";

import { createContext, useContext, useEffect, useMemo } from "react";

import { getFormat } from "@/lib/format";
import { getDictionary, translateMessage } from "@/lib/i18n";
import { DEFAULT_LOCALE, INTL_LOCALE, type Locale } from "@/lib/i18n/config";

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

// Passa o idioma da requisição para os componentes do navegador. O <html>
// é renderizado antes de o idioma ser lido, então o lang é ajustado aqui.
export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.lang = INTL_LOCALE[locale];
  }, [locale]);

  return <LocaleContext value={locale}>{children}</LocaleContext>;
}

export function useI18n() {
  const locale = useContext(LocaleContext);
  return useMemo(
    () => ({
      locale,
      t: getDictionary(locale),
      f: getFormat(locale),
      tm: (message: string | undefined) => translateMessage(message, locale),
    }),
    [locale],
  );
}
