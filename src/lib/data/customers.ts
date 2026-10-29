import "server-only";

import { cache } from "react";

import { toDataError, type DataError, type DataResult } from "@/lib/data/products";
import { createClient } from "@/lib/supabase/server";
import type { Tables, TablesInsert, TablesUpdate } from "@/types/database";
import type {
  CustomerInput,
  CustomerListQuery,
  CustomerUpdateInput,
} from "@/lib/validations/customer";

// Acesso a clientes, usado pelas páginas e pela API. O RLS libera leitura,
// cadastro e edição a usuários ativos; inativar e reativar é só do admin
// (gatilho customers_guard_active).

export type Customer = {
  id: string;
  name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

function toCustomer(row: Tables<"customers">): Customer {
  return {
    id: row.id,
    name: row.name,
    document: row.document,
    email: row.email,
    phone: row.phone,
    city: row.city,
    state: row.state,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const DOCUMENT_TAKEN = "Já existe um cliente com esse CPF/CNPJ.";
const NOT_FOUND: DataError = { status: 404, code: "not_found", message: "Cliente não encontrado." };

// Tira caracteres com significado nos filtros do PostgREST e no LIKE.
function searchTerm(q: string) {
  return q.replace(/[%_,()*\\:"']/g, " ").trim();
}

export async function listCustomers(
  query: CustomerListQuery,
): Promise<DataResult<{ items: Customer[]; total: number }>> {
  const supabase = await createClient();
  const from = (query.page - 1) * query.pageSize;

  let request = supabase
    .from("customers")
    .select("*", { count: "exact" })
    .order("name")
    .order("id")
    .range(from, from + query.pageSize - 1);

  const term = searchTerm(query.q);
  if (term) {
    // CPF/CNPJ é gravado só com números: busca também pelos dígitos digitados.
    const digits = term.replace(/\D/g, "");
    const filters = [`name.ilike.%${term}%`, `email.ilike.%${term}%`];
    if (digits.length >= 3) {
      filters.push(`document.like.%${digits}%`);
    }
    request = request.or(filters.join(","));
  }
  if (query.status !== "all") {
    request = request.eq("active", query.status === "active");
  }

  const { data, error, count } = await request;
  if (error) {
    if (error.code === "PGRST103") {
      return { data: { items: [], total: count ?? 0 } };
    }
    return { error: toDataError(error, "") };
  }
  return { data: { items: data.map(toCustomer), total: count ?? 0 } };
}

export async function getCustomer(id: string): Promise<DataResult<Customer>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("customers").select("*").eq("id", id).maybeSingle();

  if (error) {
    return { error: toDataError(error, "") };
  }
  return data ? { data: toCustomer(data) } : { error: NOT_FOUND };
}

export async function createCustomer(input: CustomerInput): Promise<DataResult<Customer>> {
  const supabase = await createClient();
  const row: TablesInsert<"customers"> = {
    name: input.name,
    document: input.document ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    city: input.city ?? null,
    state: input.state ?? null,
    active: input.active,
  };
  const { data, error } = await supabase.from("customers").insert(row).select("*").single();

  if (error) {
    return { error: toDataError(error, DOCUMENT_TAKEN) };
  }
  return { data: toCustomer(data) };
}

export async function updateCustomer(
  id: string,
  input: CustomerUpdateInput,
): Promise<DataResult<Customer>> {
  const supabase = await createClient();
  const row: TablesUpdate<"customers"> = Object.fromEntries(
    Object.entries({
      name: input.name,
      document: input.document,
      email: input.email,
      phone: input.phone,
      city: input.city,
      state: input.state,
      active: input.active,
    }).filter(([, v]) => v !== undefined),
  );

  const { data, error } = await supabase
    .from("customers")
    .update(row)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) {
    return { error: toDataError(error, DOCUMENT_TAKEN) };
  }
  return data ? { data: toCustomer(data) } : { error: NOT_FOUND };
}

export type CustomerOption = Pick<Customer, "id" | "name" | "document">;

// Clientes ativos para escolher no pedido.
export const listCustomerOptions = cache(async (): Promise<DataResult<CustomerOption[]>> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id, name, document")
    .eq("active", true)
    .order("name")
    .limit(1000);

  if (error) {
    return { error: toDataError(error, "") };
  }
  return { data };
});
