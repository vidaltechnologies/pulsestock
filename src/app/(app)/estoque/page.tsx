import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";

import { StockMovementForm } from "@/components/stock/stock-movement-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireUser } from "@/lib/auth";
import { listLowStockProducts, listProductOptions, type ProductOption } from "@/lib/data/products";
import { listStockMovements } from "@/lib/data/stock";
import type { Dictionary } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { stockMovementListQuerySchema, type StockMovementType } from "@/lib/validations/stock";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.meta.stock };
}

const PAGE_SIZE = 20;

// Filtros na URL em português: ?produto=&tipo=entrada|saida|ajuste&pagina=
const TYPE_FROM_URL: Record<string, StockMovementType> = {
  entrada: "in",
  saida: "out",
  ajuste: "adjustment",
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function StockPage({ searchParams }: PageProps<"/estoque">) {
  const { t } = await getI18n();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t.meta.stock}</h1>
        <p className="text-sm text-muted-foreground">{t.stock.subtitle}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.stock.newMovement}</CardTitle>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<Skeleton className="h-72 w-full" />}>
              <NewMovement searchParams={searchParams} />
            </Suspense>
          </CardContent>
        </Card>
        <Suspense fallback={<Skeleton className="h-72 w-full" />}>
          <LowStockAlerts />
        </Suspense>
      </div>

      <section aria-labelledby="historico" className="flex flex-col gap-4">
        <h2 id="historico" className="text-lg font-semibold tracking-tight">
          {t.stock.history}
        </h2>
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <History searchParams={searchParams} />
        </Suspense>
      </section>
    </div>
  );
}

async function NewMovement({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [params, user, products] = await Promise.all([
    searchParams,
    requireUser(),
    listProductOptions(),
  ]);
  return (
    <StockMovementForm
      products={products.data ?? []}
      role={user.role}
      defaultProductId={first(params.produto)}
    />
  );
}

async function LowStockAlerts() {
  const [{ data: products, error }, { t, f }] = await Promise.all([listLowStockProducts(), getI18n()]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t.stock.lowStock}</CardTitle>
        <CardDescription>{t.stock.lowStockDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {t.stock.alertsError}
          </p>
        ) : products.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.stock.noLowStock}</p>
        ) : (
          <ul className="flex flex-col divide-y text-sm">
            {products.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                <Link href={`/estoque?produto=${p.id}`} className="min-w-0 hover:underline">
                  <span className="block truncate font-medium">{p.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{p.sku}</span>
                </Link>
                <span className="shrink-0 text-right tabular-nums">
                  <span className="font-medium text-destructive">
                    {f.integer(p.stockQuantity)} {p.unit}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {t.stock.minimum(f.integer(p.minStock))}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

async function History({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const typeParam = first(params.tipo) ?? "";
  const query = stockMovementListQuerySchema.parse({
    productId: first(params.produto) || undefined,
    type: TYPE_FROM_URL[typeParam],
    page: first(params.pagina) ?? 1,
    pageSize: PAGE_SIZE,
  });

  const [movements, products, { t, f }] = await Promise.all([
    listStockMovements(query),
    listProductOptions(),
    getI18n(),
  ]);
  if (movements.error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {t.stock.historyError}
      </p>
    );
  }

  const { items, total } = movements.data;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function pageHref(page: number) {
    const next = new URLSearchParams();
    if (query.productId) next.set("produto", query.productId);
    if (query.type) next.set("tipo", typeParam);
    if (page > 1) next.set("pagina", String(page));
    const qs = next.toString();
    return qs ? `/estoque?${qs}` : "/estoque";
  }

  return (
    <div className="flex flex-col gap-4">
      <HistoryFilters
        t={t}
        products={products.data ?? []}
        defaults={{ produto: query.productId ?? "", tipo: query.type ? typeParam : "" }}
      />

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.common.date}</TableHead>
              <TableHead>{t.common.product}</TableHead>
              <TableHead>{t.common.type}</TableHead>
              <TableHead className="text-right">{t.common.quantity}</TableHead>
              <TableHead className="hidden md:table-cell">{t.stock.reason}</TableHead>
              <TableHead className="hidden sm:table-cell">{t.stock.by}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  {query.productId || query.type
                    ? t.stock.emptyFiltered
                    : t.stock.empty}
                </TableCell>
              </TableRow>
            ) : (
              items.map((m) => {
                const signed = m.type === "out" ? -m.quantity : m.quantity;
                return (
                  <TableRow key={m.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
                      {f.dateTime(m.createdAt)}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{m.product.name || t.stock.removedProduct}</span>
                      <span className="block font-mono text-xs text-muted-foreground">{m.product.sku}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={m.type === "in" ? "secondary" : m.type === "out" ? "outline" : "default"}>
                        {t.stock.types[m.type]}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium tabular-nums ${signed < 0 ? "text-destructive" : ""}`}
                    >
                      {signed > 0 ? "+" : "−"}
                      {f.integer(Math.abs(signed))} {m.product.unit}
                    </TableCell>
                    <TableCell className="hidden max-w-64 truncate text-muted-foreground md:table-cell">
                      {m.reason ?? "—"}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {m.createdBy.name ?? "—"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <nav aria-label={t.common.pagination} className="flex items-center justify-between gap-4 text-sm">
        <p className="text-muted-foreground">
          {t.stock.count(total, f.integer(total))}
          {pageCount > 1 && t.common.pageOf(query.page, pageCount)}
        </p>
        {pageCount > 1 && (
          <div className="flex gap-2">
            {query.page > 1 ? (
              <Button asChild variant="outline" size="sm">
                <Link href={pageHref(query.page - 1)}>{t.common.previous}</Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                {t.common.previous}
              </Button>
            )}
            {query.page < pageCount ? (
              <Button asChild variant="outline" size="sm">
                <Link href={pageHref(query.page + 1)}>{t.common.next}</Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                {t.common.next}
              </Button>
            )}
          </div>
        )}
      </nav>
    </div>
  );
}

function HistoryFilters({
  t,
  products,
  defaults,
}: {
  t: Dictionary;
  products: ProductOption[];
  defaults: { produto: string; tipo: string };
}) {
  return (
    <Form action="/estoque" className="flex flex-wrap items-end gap-3">
      <div className="flex min-w-48 flex-1 flex-col gap-1.5">
        <Label htmlFor="filtro-produto">{t.common.product}</Label>
        <NativeSelect id="filtro-produto" name="produto" className="w-full" wrapperClassName="w-full" defaultValue={defaults.produto}>
          <NativeSelectOption value="">{t.common.all}</NativeSelectOption>
          {products.map((p) => (
            <NativeSelectOption key={p.id} value={p.id}>
              {p.sku} · {p.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="filtro-tipo">{t.common.type}</Label>
        <NativeSelect id="filtro-tipo" name="tipo" defaultValue={defaults.tipo}>
          <NativeSelectOption value="">{t.common.all}</NativeSelectOption>
          <NativeSelectOption value="entrada">{t.stock.typeFilters.in}</NativeSelectOption>
          <NativeSelectOption value="saida">{t.stock.typeFilters.out}</NativeSelectOption>
          <NativeSelectOption value="ajuste">{t.stock.typeFilters.adjustment}</NativeSelectOption>
        </NativeSelect>
      </div>
      <Button type="submit" variant="secondary">
        {t.common.filter}
      </Button>
    </Form>
  );
}
