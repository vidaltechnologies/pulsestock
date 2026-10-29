"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { INTL_LOCALE, LOCALE_COOKIE, LOCALES, type Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

import { useI18n } from "./i18n-provider";

// Cada idioma com o nome escrito nele mesmo, como nos outros projetos.
const NAMES: Record<Locale, string> = {
  pt: "Português",
  en: "English",
  es: "Español",
};

// Bandeiras em SVG: emojis de bandeira não aparecem no Windows.
const FLAGS: Record<Locale, React.ReactNode> = {
  pt: (
    <svg viewBox="0 0 30 20" aria-hidden className="size-full">
      <rect width="30" height="20" fill="#009C3B" />
      <path d="M15 2.5 27.5 10 15 17.5 2.5 10Z" fill="#FFDF00" />
      <circle cx="15" cy="10" r="4.6" fill="#002776" />
      <path d="M10.6 8.9c3-.5 6.3 0 8.8 1.6" fill="none" stroke="#fff" strokeWidth=".9" />
    </svg>
  ),
  en: (
    <svg viewBox="0 0 30 20" aria-hidden className="size-full">
      <rect width="30" height="20" fill="#B22234" />
      {[1, 3, 5, 7, 9, 11].map((i) => (
        <rect key={i} y={(i * 20) / 13} width="30" height={20 / 13} fill="#fff" />
      ))}
      <rect width="12" height={(7 * 20) / 13} fill="#3C3B6E" />
      {[0, 1, 2].flatMap((r) =>
        [0, 1, 2].map((c) => <circle key={`${r}-${c}`} cx={2.2 + c * 3.8} cy={2 + r * 3.6} r=".7" fill="#fff" />),
      )}
    </svg>
  ),
  es: (
    <svg viewBox="0 0 30 20" aria-hidden className="size-full">
      <rect width="30" height="20" fill="#AA151B" />
      <rect y="5" width="30" height="10" fill="#F1BF00" />
    </svg>
  ),
};

const ONE_YEAR = 60 * 60 * 24 * 365;

// Lido no servidor a cada requisição (getLocale).
function saveLocale(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
}

export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(next: Locale) {
    if (next === locale) {
      return;
    }
    saveLocale(next);
    // Renderiza a página de novo no servidor, já com o idioma novo.
    startTransition(() => router.refresh());
  }

  return (
    <nav aria-label={t.language.label} aria-busy={pending} className={cn("flex items-center gap-2.5", className)}>
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          lang={INTL_LOCALE[l]}
          title={NAMES[l]}
          aria-label={NAMES[l]}
          aria-current={l === locale ? "true" : undefined}
          onClick={() => choose(l)}
          className={cn(
            "h-4 w-6 shrink-0 cursor-pointer overflow-hidden rounded-[3px] opacity-60 transition-[opacity,box-shadow] hover:opacity-100",
            "focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-primary",
            "aria-[current=true]:opacity-100 aria-[current=true]:ring-2 aria-[current=true]:ring-primary aria-[current=true]:ring-offset-2 aria-[current=true]:ring-offset-background",
          )}
        >
          {FLAGS[l]}
        </button>
      ))}
    </nav>
  );
}
