"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { ApiErrorBody } from "@/lib/api";
import type { CustomerOption } from "@/lib/data/customers";
import type { Order } from "@/lib/data/orders";
import type { ProductOption } from "@/lib/data/products";
import { formatCurrency, formatInteger } from "@/lib/format";
import { formatDocument } from "@/lib/validations/customer";
import { orderSchema, type OrderFormValues, type OrderInput } from "@/lib/validations/order";

// Cadastro e edição de pedido pendente. O preço mostrado é o preço de venda
// atual; o banco grava esse mesmo preço em cada item ao salvar.
export function OrderForm({
  order,
  customers,
  products,
}: {
  order?: Order;
  customers: CustomerOption[];
  products: ProductOption[];
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [newProductId, setNewProductId] = useState("");
  const [newQuantity, setNewQuantity] = useState("1");

  const productById = new Map(products.map((p) => [p.id, p]));

  const {
    register,
    handleSubmit,
    control,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<OrderFormValues, unknown, OrderInput>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      customerId: order?.customer.id ?? "",
      notes: order?.notes ?? "",
      items: order?.items.map((i) => ({ productId: i.product.id, quantity: String(i.quantity) })) ?? [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const items = useWatch({ control, name: "items" }) ?? [];

  const total = items.reduce((sum, item) => {
    const price = productById.get(item.productId)?.salePrice ?? 0;
    const qty = Number(item.quantity);
    return sum + (Number.isFinite(qty) ? qty * price : 0);
  }, 0);

  function addItem() {
    const qty = Number(newQuantity);
    if (!newProductId || !Number.isInteger(qty) || qty < 1) {
      return;
    }
    const index = getValues("items").findIndex((i) => i.productId === newProductId);
    if (index >= 0) {
      const current = Number(getValues(`items.${index}.quantity`)) || 0;
      setValue(`items.${index}.quantity`, String(current + qty), { shouldValidate: true });
    } else {
      append({ productId: newProductId, quantity: String(qty) });
    }
    setNewProductId("");
    setNewQuantity("1");
  }

  async function onSubmit(values: OrderInput) {
    setFormError(null);

    let response: Response;
    try {
      response = await fetch(order ? `/api/orders/${order.id}` : "/api/orders", {
        method: order ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
    } catch {
      setFormError("Não foi possível conectar. Verifique sua internet.");
      return;
    }

    const body = (await response.json().catch(() => null)) as
      | ({ data: { id: string } } & Partial<ApiErrorBody>)
      | null;

    if (!response.ok || !body?.data) {
      setFormError(body?.error?.message ?? "Não foi possível salvar o pedido. Tente de novo.");
      return;
    }

    router.push(`/pedidos/${body.data.id}`);
    router.refresh();
  }

  const missingProduct = (productId: string) =>
    order?.items.find((i) => i.product.id === productId)?.product;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor="customerId">Cliente</Label>
        {customers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum cliente ativo. <Link href="/clientes/novo" className="text-primary hover:underline">Cadastre um cliente</Link> primeiro.
          </p>
        ) : (
          <NativeSelect
            id="customerId"
            className="w-full"
            wrapperClassName="w-full max-w-xl"
            aria-invalid={!!errors.customerId}
            {...register("customerId")}
          >
            <NativeSelectOption value="">Escolha um cliente</NativeSelectOption>
            {customers.map((c) => (
              <NativeSelectOption key={c.id} value={c.id}>
                {c.name}
                {c.document ? ` · ${formatDocument(c.document)}` : ""}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
        {errors.customerId && <p className="text-sm text-destructive">{errors.customerId.message}</p>}
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-medium">Itens</legend>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-56 flex-1 flex-col gap-1.5">
            <Label htmlFor="new-product" className="text-muted-foreground">
              Produto
            </Label>
            <NativeSelect
              id="new-product"
              className="w-full"
              wrapperClassName="w-full"
              value={newProductId}
              onChange={(e) => setNewProductId(e.target.value)}
            >
              <NativeSelectOption value="">Escolha um produto</NativeSelectOption>
              {products.map((p) => (
                <NativeSelectOption key={p.id} value={p.id}>
                  {p.sku} · {p.name} · {formatCurrency(p.salePrice)} · saldo {formatInteger(p.stockQuantity)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="flex w-24 flex-col gap-1.5">
            <Label htmlFor="new-quantity" className="text-muted-foreground">
              Qtd.
            </Label>
            <Input
              id="new-quantity"
              inputMode="numeric"
              value={newQuantity}
              onChange={(e) => setNewQuantity(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addItem();
                }
              }}
            />
          </div>
          <Button type="button" variant="secondary" onClick={addItem} disabled={!newProductId}>
            <Plus aria-hidden />
            Adicionar
          </Button>
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead className="w-28">Qtd.</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Preço</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Remover</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Nenhum item adicionado.
                  </TableCell>
                </TableRow>
              ) : (
                fields.map((field, index) => {
                  const item = items[index];
                  const product = productById.get(item?.productId ?? field.productId);
                  const fallback = missingProduct(field.productId);
                  const qty = Number(item?.quantity);
                  const price = product?.salePrice ?? 0;
                  const error = errors.items?.[index]?.quantity?.message;
                  return (
                    <TableRow key={field.id}>
                      <TableCell>
                        <span className="font-medium">{product?.name ?? fallback?.name}</span>
                        <span className="block font-mono text-xs text-muted-foreground">
                          {product?.sku ?? fallback?.sku}
                        </span>
                        {!product && (
                          <span className="block text-xs text-destructive">Produto inativo: remova do pedido.</span>
                        )}
                        {product && qty > product.stockQuantity && (
                          <span className="block text-xs text-amber-700 dark:text-amber-300">
                            Saldo atual: {formatInteger(product.stockQuantity)} {product.unit}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Input
                          aria-label={`Quantidade de ${product?.name ?? fallback?.name ?? "produto"}`}
                          inputMode="numeric"
                          aria-invalid={!!error}
                          {...register(`items.${index}.quantity`)}
                        />
                        {error && <span className="mt-1 block text-xs text-destructive">{error}</span>}
                      </TableCell>
                      <TableCell className="hidden text-right tabular-nums sm:table-cell">
                        {formatCurrency(price)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(Number.isFinite(qty) ? qty * price : 0)}
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => remove(index)}
                          aria-label={`Remover ${product?.name ?? fallback?.name ?? "item"}`}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="font-medium">
                  Total
                </TableCell>
                <TableCell className="hidden sm:table-cell" />
                <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(total)}</TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </div>
        {errors.items?.message && <p className="text-sm text-destructive">{errors.items.message}</p>}
        {errors.items?.root?.message && <p className="text-sm text-destructive">{errors.items.root.message}</p>}
      </fieldset>

      <div className="flex max-w-xl flex-col gap-2">
        <Label htmlFor="notes">Observações (opcional)</Label>
        <Textarea id="notes" rows={3} aria-invalid={!!errors.notes} {...register("notes")} />
        {errors.notes && <p className="text-sm text-destructive">{errors.notes.message}</p>}
      </div>

      {formError && (
        <p
          role="alert"
          className="max-w-xl rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {formError}
        </p>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
          {order ? "Salvar pedido" : "Criar pedido"}
        </Button>
        <Button asChild variant="outline">
          <Link href={order ? `/pedidos/${order.id}` : "/pedidos"}>Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
