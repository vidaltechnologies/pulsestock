import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";

import { I18nProvider } from "@/components/i18n/i18n-provider";
import { getI18n, getLocale } from "@/lib/i18n/server";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: {
      default: "Pulse Stock",
      template: "%s | Pulse Stock",
    },
    description: t.meta.description,
  };
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        {/* O idioma vem do cookie da requisição, então fica atrás de Suspense
            (Cache Components) e todas as páginas renderizam por requisição. */}
        <Suspense>
          <LocaleRoot>{children}</LocaleRoot>
        </Suspense>
      </body>
    </html>
  );
}

async function LocaleRoot({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return <I18nProvider locale={locale}>{children}</I18nProvider>;
}
