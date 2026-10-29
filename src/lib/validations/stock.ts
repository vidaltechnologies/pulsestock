import { z } from "zod";

export const STOCK_MOVEMENT_TYPES = ["in", "out", "adjustment"] as const;
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

export const STOCK_MOVEMENT_LABELS: Record<StockMovementType, string> = {
  in: "Entrada",
  out: "Saída",
  adjustment: "Ajuste",
};

// Tipos que só o administrador registra (o RLS aplica a mesma regra).
export const ADMIN_ONLY_TYPES: StockMovementType[] = ["out", "adjustment"];

function emptyToUndefined(value: unknown) {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

export const stockMovementSchema = z
  .object({
    productId: z.uuid({ error: "Escolha um produto." }),
    type: z.enum(STOCK_MOVEMENT_TYPES, { error: "Escolha o tipo." }),
    quantity: z.preprocess(
      (v) => {
        const value = emptyToUndefined(v);
        return typeof value === "string" ? Number(value.trim()) : value;
      },
      z
        .number({ error: "Informe a quantidade." })
        .int("Use um número inteiro.")
        .min(-1_000_000, "Valor alto demais.")
        .max(1_000_000, "Valor alto demais."),
    ),
    reason: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? null : v),
      z.string().trim().max(500, "Use no máximo 500 caracteres.").nullish(),
    ),
  })
  // Entrada e saída usam quantidade positiva; ajuste usa a diferença com
  // sinal (ex.: -3 para corrigir uma contagem a menor).
  .superRefine((data, ctx) => {
    if (data.type === "adjustment" && data.quantity === 0) {
      ctx.addIssue({ code: "custom", path: ["quantity"], message: "O ajuste não pode ser zero." });
    }
    if (data.type !== "adjustment" && data.quantity <= 0) {
      ctx.addIssue({ code: "custom", path: ["quantity"], message: "Use uma quantidade maior que zero." });
    }
  });

export type StockMovementFormValues = z.input<typeof stockMovementSchema>;
export type StockMovementInput = z.output<typeof stockMovementSchema>;

export const stockMovementListQuerySchema = z.object({
  productId: z.uuid().optional().catch(undefined),
  type: z.enum(STOCK_MOVEMENT_TYPES).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
  pageSize: z.coerce.number().int().min(1).max(100).catch(20),
});

export type StockMovementListQuery = z.output<typeof stockMovementListQuerySchema>;
