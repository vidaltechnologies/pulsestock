// Idiomas da interface. O português é o idioma de origem: os textos do código
// e do banco são escritos nele e traduzidos para os outros na hora de mostrar.
export const LOCALES = ["pt", "en", "es"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "pt";

// Cookie com a escolha do usuário. Sem ele, vale o idioma do navegador.
export const LOCALE_COOKIE = "locale";

// Formato de números e datas de cada idioma. A moeda continua sendo o real.
export const INTL_LOCALE: Record<Locale, string> = {
  pt: "pt-BR",
  en: "en-US",
  es: "es-ES",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

// "en-US,en;q=0.9,pt;q=0.8" → "en". Respeita a ordem de preferência (q).
export function localeFromAcceptLanguage(header: string | null | undefined): Locale {
  if (!header) {
    return DEFAULT_LOCALE;
  }
  const ranked = header
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      return { language: tag.trim().slice(0, 2).toLowerCase(), q: q ? Number(q.trim().slice(2)) : 1, index };
    })
    .filter((entry) => entry.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);

  return ranked.find((entry) => isLocale(entry.language))?.language as Locale | undefined ?? DEFAULT_LOCALE;
}
