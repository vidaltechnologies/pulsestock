import { z } from "zod";

// Campos vazios do formulário chegam como "". Aqui viram undefined (para o
// campo cair no valor padrão ou na mensagem de obrigatório) e números com
// vírgula, como "12,50", são aceitos.
function emptyToUndefined(value: unknown) {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

// Texto opcional apagado no formulário vira null, para limpar o campo na edição.
function emptyToNull(value: unknown) {
  return typeof value === "string" && value.trim() === "" ? null : value;
}

function toNumber(value: unknown) {
  const v = emptyToUndefined(value);
  return typeof v === "string" ? Number(v.trim().replace(",", ".")) : v;
}

const money = (label: string) =>
  z.preprocess(
    toNumber,
    z
      .number({ error: `Informe ${label}.` })
      .min(0, `${label[0].toUpperCase()}${label.slice(1)} não pode ser negativo.`)
      .max(9_999_999_999.99, "Valor alto demais.")
      .refine((v) => Math.abs(Math.round(v * 100) - v * 100) < 1e-6, "Use no máximo 2 casas decimais."),
  );

const quantity = z.preprocess(
  toNumber,
  z
    .number({ error: "Informe um número." })
    .int("Use um número inteiro.")
    .min(0, "Não pode ser negativo.")
    .max(2_147_483_647, "Valor alto demais."),
);

export const productSchema = z.object({
  sku: z
    .string({ error: "Informe o SKU." })
    .trim()
    .toUpperCase()
    .min(1, "Informe o SKU.")
    .max(40, "Use no máximo 40 caracteres.")
    .regex(
      /^[A-Z0-9][A-Z0-9._-]*$/,
      "Use letras, números, ponto, hífen ou sublinhado, começando por letra ou número.",
    ),
  name: z
    .string({ error: "Informe o nome." })
    .trim()
    .min(1, "Informe o nome.")
    .max(120, "Use no máximo 120 caracteres."),
  description: z.preprocess(
    emptyToNull,
    z.string().trim().max(1000, "Use no máximo 1000 caracteres.").nullish(),
  ),
  categoryId: z.preprocess(emptyToNull, z.uuid("Categoria inválida.").nullish()),
  unit: z.preprocess(
    emptyToUndefined,
    z.string().trim().toUpperCase().max(10, "Use no máximo 10 caracteres.").default("UN"),
  ),
  costPrice: z.preprocess(emptyToUndefined, money("o preço de custo").default(0)),
  salePrice: money("o preço de venda"),
  minStock: z.preprocess(emptyToUndefined, quantity.default(0)),
  active: z.boolean().default(true),
});

// Edição: todos os campos são opcionais, mas ao menos um precisa vir.
export const productUpdateSchema = z
  .object({
    sku: productSchema.shape.sku,
    name: productSchema.shape.name,
    description: productSchema.shape.description,
    categoryId: productSchema.shape.categoryId,
    unit: z.string().trim().toUpperCase().min(1, "Informe a unidade.").max(10, "Use no máximo 10 caracteres."),
    costPrice: money("o preço de custo"),
    salePrice: productSchema.shape.salePrice,
    minStock: quantity,
    active: z.boolean(),
  })
  .partial()
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "Envie ao menos um campo para alterar.",
  });

export type ProductFormValues = z.input<typeof productSchema>;
export type ProductInput = z.output<typeof productSchema>;
export type ProductUpdateInput = z.output<typeof productUpdateSchema>;

export const PRODUCT_STATUS = ["active", "inactive", "all"] as const;

// Filtros da listagem. Valores inválidos caem no padrão em vez de dar erro.
export const productListQuerySchema = z.object({
  q: z.string().trim().max(100).catch(""),
  categoryId: z.uuid().optional().catch(undefined),
  status: z.enum(PRODUCT_STATUS).catch("active"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
  pageSize: z.coerce.number().int().min(1).max(100).catch(20),
});

export type ProductListQuery = z.output<typeof productListQuerySchema>;

export const categorySchema = z.object({
  name: z
    .string({ error: "Informe o nome." })
    .trim()
    .min(1, "Informe o nome.")
    .max(80, "Use no máximo 80 caracteres."),
});

export type CategoryInput = z.output<typeof categorySchema>;
