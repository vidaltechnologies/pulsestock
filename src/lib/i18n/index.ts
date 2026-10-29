import { getFormat } from "@/lib/format";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import { en } from "@/lib/i18n/dictionaries/en";
import { es } from "@/lib/i18n/dictionaries/es";
import { pt, type Dictionary } from "@/lib/i18n/dictionaries/pt";

export type { Dictionary } from "@/lib/i18n/dictionaries/pt";

const DICTIONARIES: Record<Locale, Dictionary> = { pt, en, es };

export function getDictionary(locale: Locale = DEFAULT_LOCALE): Dictionary {
  return DICTIONARIES[locale];
}

type MessageKey = keyof Dictionary["messages"];

// Texto em português → chave, para achar a tradução de uma mensagem.
const MESSAGE_KEYS = new Map(
  (Object.entries(pt.messages) as [MessageKey, string][]).map(([key, text]) => [text, key]),
);

// Mensagens com valores. As expressões casam com o texto em português gerado
// pelos esquemas Zod e pelas funções do banco (migrações 0004 e 0005).
const PATTERNS: {
  regex: RegExp;
  translate: (dict: Dictionary, locale: Locale, groups: string[]) => string;
}[] = [
  {
    regex: /^Use no máximo (\d+) caracteres\.$/,
    translate: (d, _l, [max]) => d.messagePatterns.maxChars(max),
  },
  {
    regex: /^Estoque insuficiente para "(.+)": o pedido tem (-?\d+) e o saldo é (-?\d+) (.*)\.$/,
    translate: (d, l, [name, ordered, stock, unit]) =>
      d.messagePatterns.insufficientStockOrder(
        name,
        getFormat(l).integer(Number(ordered)),
        getFormat(l).integer(Number(stock)),
        unit,
      ),
  },
  {
    regex: /^Estoque insuficiente: o saldo atual é (-?\d+) (.*)\.$/,
    translate: (d, l, [stock, unit]) =>
      d.messagePatterns.insufficientStock(getFormat(l).integer(Number(stock)), unit),
  },
  {
    regex: /^O produto "(.+)" está inativo\. Tire-o do pedido antes de confirmar\.$/,
    translate: (d, _l, [name]) => d.messagePatterns.inactiveProductConfirm(name),
  },
  {
    regex: /^O produto "(.+)" está inativo\.$/,
    translate: (d, _l, [name]) => d.messagePatterns.inactiveProduct(name),
  },
  {
    // O banco escreve o status como no enum ("pending"): vira o nome na tela.
    regex: /^Não é possível mudar o pedido de "(\w+)" para "(\w+)"\.$/,
    translate: (d, _l, [from, to]) => {
      const label = (status: string) =>
        d.orders.statuses[status as keyof Dictionary["orders"]["statuses"]] ?? status;
      return d.messagePatterns.invalidTransition(label(from), label(to));
    },
  },
];

// Traduz uma mensagem de validação, da API ou do banco. Mensagem desconhecida
// volta como veio.
export function translateMessage(message: string, locale: Locale): string;
export function translateMessage(message: string | undefined, locale: Locale): string | undefined;
export function translateMessage(message: string | undefined, locale: Locale) {
  if (!message) {
    return message;
  }
  const dict = getDictionary(locale);
  const key = MESSAGE_KEYS.get(message);
  if (key) {
    return dict.messages[key];
  }
  for (const { regex, translate } of PATTERNS) {
    const match = regex.exec(message);
    if (match) {
      return translate(dict, locale, match.slice(1));
    }
  }
  return message;
}
