import { z } from "zod";

// Dígitos verificadores de CPF (11 dígitos) e CNPJ (14 dígitos).
function cpfValid(cpf: string) {
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  for (const length of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += Number(cpf[i]) * (length + 1 - i);
    const digit = ((sum * 10) % 11) % 10;
    if (digit !== Number(cpf[length])) return false;
  }
  return true;
}

function cnpjValid(cnpj: string) {
  if (/^(\d)\1{13}$/.test(cnpj)) return false;
  for (const length of [12, 13]) {
    let sum = 0;
    let weight = length - 7;
    for (let i = 0; i < length; i++) {
      sum += Number(cnpj[i]) * weight;
      weight = weight === 2 ? 9 : weight - 1;
    }
    const rest = sum % 11;
    const digit = rest < 2 ? 0 : 11 - rest;
    if (digit !== Number(cnpj[length])) return false;
  }
  return true;
}

export function isValidDocument(digits: string) {
  if (digits.length === 11) return cpfValid(digits);
  if (digits.length === 14) return cnpjValid(digits);
  return false;
}

// 12345678909 → 123.456.789-09; 11222333000181 → 11.222.333/0001-81
export function formatDocument(digits: string) {
  if (digits.length === 11) return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (digits.length === 14) return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return digits;
}

export const BRAZILIAN_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

// Campo opcional apagado no formulário vira null, para limpar o valor na edição.
function emptyToNull(value: unknown) {
  return typeof value === "string" && value.trim() === "" ? null : value;
}

const optionalText = (max: number) =>
  z.preprocess(emptyToNull, z.string().trim().max(max, `Use no máximo ${max} caracteres.`).nullish());

const fields = {
  name: z
    .string({ error: "Informe o nome." })
    .trim()
    .min(1, "Informe o nome.")
    .max(120, "Use no máximo 120 caracteres."),
  // Aceita com ou sem máscara; grava só os números.
  document: z.preprocess(
    (v) => (typeof v === "string" ? (v.replace(/\D/g, "") || null) : v),
    z
      .string()
      .refine((v) => v.length === 11 || v.length === 14, "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).")
      .refine(isValidDocument, "CPF ou CNPJ inválido.")
      .nullish(),
  ),
  email: z.preprocess(
    emptyToNull,
    z
      .string()
      .trim()
      .toLowerCase()
      .max(254, "E-mail longo demais.")
      .pipe(z.email("E-mail inválido."))
      .nullish(),
  ),
  phone: optionalText(20),
  city: optionalText(80),
  state: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toUpperCase() || null : v),
    z.enum(BRAZILIAN_STATES, { error: "UF inválida." }).nullish(),
  ),
  active: z.boolean(),
};

export const customerSchema = z.object({ ...fields, active: fields.active.default(true) });

export const customerUpdateSchema = z
  .object(fields)
  .partial()
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "Envie ao menos um campo para alterar.",
  });

export type CustomerFormValues = z.input<typeof customerSchema>;
export type CustomerInput = z.output<typeof customerSchema>;
export type CustomerUpdateInput = z.output<typeof customerUpdateSchema>;

export const CUSTOMER_STATUS = ["active", "inactive", "all"] as const;

export const customerListQuerySchema = z.object({
  q: z.string().trim().max(100).catch(""),
  status: z.enum(CUSTOMER_STATUS).catch("active"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
  pageSize: z.coerce.number().int().min(1).max(100).catch(20),
});

export type CustomerListQuery = z.output<typeof customerListQuerySchema>;
