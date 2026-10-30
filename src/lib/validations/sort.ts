import { z } from "zod";

// Ordenação das listagens: `sort=campo` (crescente) ou `sort=-campo`
// (decrescente), só com os campos permitidos em cada recurso. Valor inválido
// cai no padrão, como os outros filtros.
export type SortValue<F extends string> = F | `-${F}`;

export function sortSchema<const F extends string>(fields: readonly F[], fallback: SortValue<F>) {
  const values = fields.flatMap((f) => [f, `-${f}`]) as [SortValue<F>, ...SortValue<F>[]];
  // O cast contorna a inferência do Zod com tipos genéricos; o valor é um dos `values`.
  return z.enum(values).catch(fallback as never) as z.ZodType<SortValue<F>, string | undefined>;
}

export function parseSort<F extends string>(sort: SortValue<F>): { field: F; ascending: boolean } {
  return sort.startsWith("-")
    ? { field: sort.slice(1) as F, ascending: false }
    : { field: sort as F, ascending: true };
}
