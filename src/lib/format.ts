import { DEFAULT_LOCALE, INTL_LOCALE, type Locale } from "@/lib/i18n/config";

// Datas e horas são mostradas no fuso de São Paulo, o mesmo usado pelo banco
// para agrupar as vendas por dia.
const TIME_ZONE = "America/Sao_Paulo";

function createFormat(locale: Locale) {
  const tag = INTL_LOCALE[locale];
  // narrowSymbol: "R$" em todos os idiomas (o espanhol escreveria "BRL").
  const currency = new Intl.NumberFormat(tag, { style: "currency", currency: "BRL", currencyDisplay: "narrowSymbol" });
  const compactCurrency = new Intl.NumberFormat(tag, {
    style: "currency",
    currency: "BRL",
    currencyDisplay: "narrowSymbol",
    notation: "compact",
    maximumFractionDigits: 1,
  });
  const integer = new Intl.NumberFormat(tag);
  const date = new Intl.DateTimeFormat(tag, { dateStyle: "short", timeZone: TIME_ZONE });
  const dateTime = new Intl.DateTimeFormat(tag, {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: TIME_ZONE,
  });
  // Dias do banco ("2026-10-29") já estão no fuso certo: formatados em UTC
  // para não mudarem de data.
  const day = new Intl.DateTimeFormat(tag, { dateStyle: "short", timeZone: "UTC" });
  const shortDay = new Intl.DateTimeFormat(tag, { day: "2-digit", month: "2-digit", timeZone: "UTC" });
  const month = new Intl.DateTimeFormat(tag, { month: "long", timeZone: "UTC" });
  const fromDay = (value: string) => new Date(`${value}T00:00:00Z`);

  return {
    currency: (value: number) => currency.format(value),
    compactCurrency: (value: number) => compactCurrency.format(value),
    integer: (value: number) => integer.format(value),
    date: (iso: string) => date.format(new Date(iso)),
    dateTime: (iso: string) => dateTime.format(new Date(iso)),
    day: (value: string) => day.format(fromDay(value)),
    shortDay: (value: string) => shortDay.format(fromDay(value)),
    month: (value: string) => month.format(fromDay(value)),
  };
}

export type Format = ReturnType<typeof createFormat>;

const cache = new Map<Locale, Format>();

export function getFormat(locale: Locale = DEFAULT_LOCALE): Format {
  let format = cache.get(locale);
  if (!format) {
    format = createFormat(locale);
    cache.set(locale, format);
  }
  return format;
}
