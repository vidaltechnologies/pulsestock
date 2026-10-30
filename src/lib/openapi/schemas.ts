import { z } from "zod";

import { APP_ROLES } from "@/lib/validations/user";
import { ORDER_STATUSES } from "@/lib/validations/order";
import { STOCK_MOVEMENT_TYPES } from "@/lib/validations/stock";

// Formato das respostas da API, só para a documentação OpenAPI. Os tipos
// batem com os de src/lib/data (conferido em openapi.test.ts). Cada esquema
// registrado vira um componente em #/components/schemas.

export const API_SCHEMAS = z.registry<{ id: string }>();

const id = z.uuid();
const timestamp = z.string().meta({ format: "date-time", example: "2026-10-30T15:00:00Z" });
const day = z.string().meta({ format: "date", example: "2026-10-30" });
const money = z.number().meta({ description: "Valor em reais", example: 19.9 });

export const CategorySchema = z.object({ id, name: z.string() }).register(API_SCHEMAS, { id: "Category" });

export const ProductSchema = z
  .object({
    id,
    sku: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    category: CategorySchema.nullable(),
    unit: z.string(),
    costPrice: money,
    salePrice: money,
    stockQuantity: z.int(),
    minStock: z.int(),
    lowStock: z.boolean().meta({ description: "Saldo no mínimo ou abaixo dele" }),
    active: z.boolean(),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .register(API_SCHEMAS, { id: "Product" });

export const StockMovementSchema = z
  .object({
    id,
    type: z.enum(STOCK_MOVEMENT_TYPES),
    quantity: z.int().meta({ description: "Positivo; no ajuste, negativo tira do saldo" }),
    reason: z.string().nullable(),
    orderId: z.uuid().nullable().meta({ description: "Pedido que gerou a movimentação" }),
    createdAt: timestamp,
    product: z.object({ id, sku: z.string(), name: z.string(), unit: z.string() }),
    createdBy: z.object({ id, name: z.string().nullable() }),
  })
  .register(API_SCHEMAS, { id: "StockMovement" });

export const StockMovementResultSchema = z
  .object({ movement: StockMovementSchema, stockQuantity: z.int().meta({ description: "Saldo novo" }) })
  .register(API_SCHEMAS, { id: "StockMovementResult" });

export const CustomerSchema = z
  .object({
    id,
    name: z.string(),
    document: z.string().nullable().meta({ description: "CPF ou CNPJ, só números" }),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    city: z.string().nullable(),
    state: z.string().nullable(),
    active: z.boolean(),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .register(API_SCHEMAS, { id: "Customer" });

const orderStatus = z.enum(ORDER_STATUSES);

export const OrderSummarySchema = z
  .object({
    id,
    number: z.int(),
    status: orderStatus,
    totalAmount: money,
    createdAt: timestamp,
    confirmedAt: timestamp.nullable(),
    customer: z.object({ id, name: z.string() }),
  })
  .register(API_SCHEMAS, { id: "OrderSummary" });

export const OrderSchema = z
  .object({
    ...OrderSummarySchema.shape,
    notes: z.string().nullable(),
    updatedAt: timestamp,
    customer: z.object({
      id,
      name: z.string(),
      document: z.string().nullable(),
      email: z.string().nullable(),
      phone: z.string().nullable(),
    }),
    createdBy: z.object({ id, name: z.string().nullable() }),
    items: z.array(
      z.object({
        id,
        quantity: z.int(),
        unitPrice: money,
        subtotal: money,
        product: z.object({
          id,
          sku: z.string(),
          name: z.string(),
          unit: z.string(),
          stockQuantity: z.int(),
        }),
      }),
    ),
  })
  .register(API_SCHEMAS, { id: "Order" });

export const DashboardSchema = z
  .object({
    today: day,
    monthStart: day,
    periodStart: day,
    monthSales: money,
    monthOrders: z.int(),
    averageTicket: money,
    pendingOrders: z.int(),
    lowStockProducts: z.int(),
    salesByDay: z.array(z.object({ day, total: money, orders: z.int() })),
    topProducts: z.array(
      z.object({
        id,
        name: z.string(),
        sku: z.string(),
        unit: z.string(),
        quantity: z.int(),
        total: money,
      }),
    ),
    ordersByStatus: z.partialRecord(orderStatus, z.int()),
    monthMargin: money.nullable().meta({ description: "null para o operador" }),
    stockValue: money.nullable().meta({ description: "null para o operador" }),
  })
  .register(API_SCHEMAS, { id: "Dashboard" });

const role = z.enum(APP_ROLES);

export const CurrentUserSchema = z
  .object({ id, email: z.string(), fullName: z.string(), role })
  .register(API_SCHEMAS, { id: "CurrentUser" });

export const UserSchema = z
  .object({
    id,
    email: z.string(),
    fullName: z.string(),
    role,
    active: z.boolean(),
    createdAt: timestamp,
    lastSignInAt: timestamp.nullable(),
  })
  .register(API_SCHEMAS, { id: "User" });

export const TokenSchema = z
  .object({
    tokenType: z.literal("Bearer"),
    accessToken: z.string().meta({ description: "Envie em Authorization: Bearer <accessToken>" }),
    refreshToken: z.string().meta({ description: "Use em POST /auth/refresh; vale uma vez" }),
    expiresIn: z.int().meta({ description: "Validade do accessToken, em segundos" }),
    expiresAt: z.int().optional().meta({ description: "Quando o accessToken expira (Unix, segundos)" }),
    user: CurrentUserSchema,
  })
  .register(API_SCHEMAS, { id: "Token" });

export const OkSchema = z.object({ ok: z.literal(true) }).register(API_SCHEMAS, { id: "Ok" });

export const PaginationSchema = z
  .object({
    page: z.int(),
    pageSize: z.int(),
    total: z.int().meta({ description: "Total de itens com os filtros aplicados" }),
    totalPages: z.int(),
  })
  .register(API_SCHEMAS, { id: "Pagination" });

export const ErrorSchema = z
  .object({
    error: z.object({
      code: z.string().meta({ example: "validation_error" }),
      message: z.string().meta({ description: "No idioma de quem chamou (Accept-Language)" }),
      details: z
        .record(z.string(), z.array(z.string()))
        .optional()
        .meta({ description: "Erros por campo da validação" }),
    }),
  })
  .register(API_SCHEMAS, { id: "Error" });
