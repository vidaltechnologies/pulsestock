const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const integer = new Intl.NumberFormat("pt-BR");

export function formatCurrency(value: number) {
  return currency.format(value);
}

export function formatInteger(value: number) {
  return integer.format(value);
}
