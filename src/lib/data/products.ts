import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import type { Tables, TablesInsert, TablesUpdate } from "@/types/database";
import type {
  CategoryInput,
  ProductInput,
  ProductListQuery,
  ProductUpdateInput,
} from "@/lib/validations/product";

// Acesso a produtos e categorias, usado pelas páginas e pela API. Roda com a
// sessão do usuário, então o RLS decide o que cada perfil pode ler e gravar.

export type Category = { id: string; name: string };

export type Product = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  category: Category | null;
  unit: string;
  costPrice: number;
  salePrice: number;
  stockQuantity: number;
  minStock: number;
  // Saldo no mínimo ou abaixo dele (coluna gerada no banco).
  lowStock: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DataError = { status: number; code: string; message: string };
export type DataResult<T> = { data: T; error?: never } | { data?: never; error: DataError };

const PRODUCT_COLUMNS = "*, category:categories(id, name)";

type ProductRow = Tables<"products"> & { category: Category | null };

function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    description: row.description,
    category: row.category,
    unit: row.unit,
    costPrice: Number(row.cost_price),
    salePrice: Number(row.sale_price),
    stockQuantity: row.stock_quantity,
    minStock: row.min_stock,
    lowStock: row.low_stock === true,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toInsertRow(input: ProductInput): TablesInsert<"products"> {
  return {
    sku: input.sku,
    name: input.name,
    description: input.description ?? null,
    category_id: input.categoryId ?? null,
    unit: input.unit,
    cost_price: input.costPrice,
    sale_price: input.salePrice,
    min_stock: input.minStock,
    active: input.active,
  };
}

function toUpdateRow(input: ProductUpdateInput): TablesUpdate<"products"> {
  const row: TablesUpdate<"products"> = {
    sku: input.sku,
    name: input.name,
    description: input.description,
    category_id: input.categoryId,
    unit: input.unit,
    cost_price: input.costPrice,
    sale_price: input.salePrice,
    min_stock: input.minStock,
    active: input.active,
  };
  // Campos ausentes não entram no update.
  return Object.fromEntries(Object.entries(row).filter(([, v]) => v !== undefined));
}

// Traduz erros do Postgres/PostgREST para respostas da API.
export function toDataError(error: PostgrestError, conflictMessage: string): DataError {
  switch (error.code) {
    case "23505":
      return { status: 409, code: "conflict", message: conflictMessage };
    case "23503":
      return { status: 400, code: "invalid_reference", message: "A categoria informada não existe." };
    case "42501":
      return { status: 403, code: "forbidden", message: "Seu perfil não tem permissão para esta ação." };
    case "22P02":
    case "23514":
      return { status: 400, code: "invalid_data", message: "Dados inválidos." };
    default:
      console.error("Erro do Supabase:", error.code, error.message);
      return { status: 500, code: "internal_error", message: "Erro inesperado. Tente de novo." };
  }
}

const NOT_FOUND: DataError = { status: 404, code: "not_found", message: "Produto não encontrado." };

// Tira caracteres com significado nos filtros do PostgREST e no LIKE.
function searchTerm(q: string) {
  return q.replace(/[%_,()*\\:"'.]/g, " ").trim();
}

export async function listProducts(query: ProductListQuery): Promise<
  DataResult<{ items: Product[]; total: number }>
> {
  const supabase = await createClient();
  const from = (query.page - 1) * query.pageSize;

  let request = supabase
    .from("products")
    .select(PRODUCT_COLUMNS, { count: "exact" })
    .order("name")
    .order("id")
    .range(from, from + query.pageSize - 1);

  const term = searchTerm(query.q);
  if (term) {
    request = request.or(`name.ilike.%${term}%,sku.ilike.%${term}%`);
  }
  if (query.categoryId) {
    request = request.eq("category_id", query.categoryId);
  }
  if (query.status !== "all") {
    request = request.eq("active", query.status === "active");
  }

  const { data, error, count } = await request;
  if (error) {
    // Página além do fim: lista vazia em vez de erro.
    if (error.code === "PGRST103") {
      return { data: { items: [], total: count ?? 0 } };
    }
    return { error: toDataError(error, "") };
  }
  return { data: { items: data.map(toProduct), total: count ?? 0 } };
}

export async function getProduct(id: string): Promise<DataResult<Product>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return { error: toDataError(error, "") };
  }
  return data ? { data: toProduct(data) } : { error: NOT_FOUND };
}

const SKU_TAKEN = "Já existe um produto com esse SKU.";

export async function createProduct(input: ProductInput): Promise<DataResult<Product>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .insert(toInsertRow(input))
    .select(PRODUCT_COLUMNS)
    .single();

  if (error) {
    return { error: toDataError(error, SKU_TAKEN) };
  }
  return { data: toProduct(data) };
}

export async function updateProduct(
  id: string,
  input: ProductUpdateInput,
): Promise<DataResult<Product>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .update(toUpdateRow(input))
    .eq("id", id)
    .select(PRODUCT_COLUMNS)
    .maybeSingle();

  if (error) {
    return { error: toDataError(error, SKU_TAKEN) };
  }
  return data ? { data: toProduct(data) } : { error: NOT_FOUND };
}

export type ProductOption = Pick<Product, "id" | "sku" | "name" | "unit" | "stockQuantity">;

// Produtos ativos para escolher num formulário (movimentação, pedido).
// Memorizado por requisição: a página de estoque usa a lista em dois lugares.
export const listProductOptions = cache(async (): Promise<DataResult<ProductOption[]>> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, sku, name, unit, stock_quantity")
    .eq("active", true)
    .order("name")
    .limit(1000);

  if (error) {
    return { error: toDataError(error, "") };
  }
  return {
    data: data.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      unit: p.unit,
      stockQuantity: p.stock_quantity,
    })),
  };
});

// Produtos ativos com saldo no mínimo ou abaixo, do menor saldo para o maior.
export async function listLowStockProducts(): Promise<DataResult<Product[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("active", true)
    .eq("low_stock", true)
    .order("stock_quantity")
    .order("name")
    .limit(50);

  if (error) {
    return { error: toDataError(error, "") };
  }
  return { data: data.map(toProduct) };
}

export async function listCategories(): Promise<DataResult<Category[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("categories").select("id, name").order("name");

  if (error) {
    return { error: toDataError(error, "") };
  }
  return { data };
}

export async function createCategory(input: CategoryInput): Promise<DataResult<Category>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .insert({ name: input.name })
    .select("id, name")
    .single();

  if (error) {
    return { error: toDataError(error, "Já existe uma categoria com esse nome.") };
  }
  return { data };
}
