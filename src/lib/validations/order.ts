import { z } from "zod";

export const ORDER_STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

// Mesmo fluxo da função change_order_status no banco.
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

export function canChangeStatus(from: OrderStatus, to: OrderStatus, isAdmin: boolean) {
  return ORDER_TRANSITIONS[from].includes(to) && (to !== "cancelled" || isAdmin);
}

const quantity = z.preprocess(
  (v) => (typeof v === "string" && v.trim() !== "" ? Number(v.trim()) : v),
  z
    .number({ error: "Informe a quantidade." })
    .int("Use um número inteiro.")
    .min(1, "Use uma quantidade maior que zero.")
    .max(1_000_000, "Valor alto demais."),
);

export const orderItemSchema = z.object({
  productId: z.uuid({ error: "Escolha um produto." }),
  quantity,
});

export const orderSchema = z.object({
  customerId: z.uuid({ error: "Escolha um cliente." }),
  notes: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().max(1000, "Use no máximo 1000 caracteres.").nullish(),
  ),
  items: z
    .array(orderItemSchema, { error: "Adicione os itens do pedido." })
    .min(1, "Adicione ao menos um item.")
    .max(100, "Use no máximo 100 itens por pedido."),
});

export type OrderFormValues = z.input<typeof orderSchema>;
export type OrderInput = z.output<typeof orderSchema>;

export const orderStatusChangeSchema = z.object({
  status: z.enum(["confirmed", "shipped", "delivered", "cancelled"], {
    error: "Status inválido.",
  }),
});

export const orderListQuerySchema = z.object({
  q: z.string().trim().max(100).catch(""),
  status: z.enum(ORDER_STATUSES).optional().catch(undefined),
  customerId: z.uuid().optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
  pageSize: z.coerce.number().int().min(1).max(100).catch(20),
});

export type OrderListQuery = z.output<typeof orderListQuerySchema>;
