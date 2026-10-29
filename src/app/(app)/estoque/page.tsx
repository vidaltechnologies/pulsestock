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
import { formatInteger } from "@/lib/format";
import {
  STOCK_MOVEMENT_LABELS,
  stockMovementListQuerySchema,
  type StockMovementType,
} from "@/lib/validations/stock";

export const metadata: Metadata = {
  title: "Estoque",
};

const PAGE_SIZE = 20;

// Filtros na URL em português: ?produto=&tipo=entrada|saida|ajuste&pagina=
const TYPE_FROM_URL: Record<string, StockMovementType> = {
  entrada: "in",
  saida: "out",
  ajuste: "adjustment",
};

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function StockPage({ searchParams }: PageProps<"/estoque">) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Estoque</h1>
        <p className="text-sm text-muted-foreground">
          Entradas, saídas e ajustes. O saldo de cada produto muda a cada movimentação.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nova movimentação</CardTitle>
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
          Histórico
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
  const { data: products, error } = await listLowStockProducts();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Estoque baixo</CardTitle>
        <CardDescription>Produtos ativos com saldo no mínimo ou abaixo.</CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            Não foi possível carregar os alertas.
          </p>
        ) : products.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum produto abaixo do mínimo.</p>
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
                    {formatInteger(p.stockQuantity)} {p.unit}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    mínimo {formatInteger(p.minStock)}
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

  const [movements, products] = await Promise.all([
    listStockMovements(query),
    listProductOptions(),
  ]);
  if (movements.error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        Não foi possível carregar o histórico. Recarregue a página.
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
        products={products.data ?? []}
        defaults={{ produto: query.productId ?? "", tipo: query.type ? typeParam : "" }}
      />

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Quantidade</TableHead>
              <TableHead className="hidden md:table-cell">Motivo</TableHead>
              <TableHead className="hidden sm:table-cell">Por</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  {query.productId || query.type
                    ? "Nenhuma movimentação com esses filtros."
                    : "Nenhuma movimentação registrada ainda."}
                </TableCell>
              </TableRow>
            ) : (
              items.map((m) => {
                const signed = m.type === "out" ? -m.quantity : m.quantity;
                return (
                  <TableRow key={m.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
                      {dateTime.format(new Date(m.createdAt))}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{m.product.name}</span>
                      <span className="block font-mono text-xs text-muted-foreground">{m.product.sku}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={m.type === "in" ? "secondary" : m.type === "out" ? "outline" : "default"}>
                        {STOCK_MOVEMENT_LABELS[m.type]}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium tabular-nums ${signed < 0 ? "text-destructive" : ""}`}
                    >
                      {signed > 0 ? "+" : "−"}
                      {formatInteger(Math.abs(signed))} {m.product.unit}
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

      <nav aria-label="Paginação" className="flex items-center justify-between gap-4 text-sm">
        <p className="text-muted-foreground">
          {total === 1 ? "1 movimentação" : `${formatInteger(total)} movimentações`}
          {pageCount > 1 && ` · página ${query.page} de ${pageCount}`}
        </p>
        {pageCount > 1 && (
          <div className="flex gap-2">
            {query.page > 1 ? (
              <Button asChild variant="outline" size="sm">
                <Link href={pageHref(query.page - 1)}>Anterior</Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                Anterior
              </Button>
            )}
            {query.page < pageCount ? (
              <Button asChild variant="outline" size="sm">
                <Link href={pageHref(query.page + 1)}>Próxima</Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                Próxima
              </Button>
            )}
          </div>
        )}
      </nav>
    </div>
  );
}

function HistoryFilters({
  products,
  defaults,
}: {
  products: ProductOption[];
  defaults: { produto: string; tipo: string };
}) {
  return (
    <Form action="/estoque" className="flex flex-wrap items-end gap-3">
      <div className="flex min-w-48 flex-1 flex-col gap-1.5">
        <Label htmlFor="filtro-produto">Produto</Label>
        <NativeSelect id="filtro-produto" name="produto" className="w-full" wrapperClassName="w-full" defaultValue={defaults.produto}>
          <NativeSelectOption value="">Todos</NativeSelectOption>
          {products.map((p) => (
            <NativeSelectOption key={p.id} value={p.id}>
              {p.sku} · {p.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="filtro-tipo">Tipo</Label>
        <NativeSelect id="filtro-tipo" name="tipo" defaultValue={defaults.tipo}>
          <NativeSelectOption value="">Todos</NativeSelectOption>
          <NativeSelectOption value="entrada">Entradas</NativeSelectOption>
          <NativeSelectOption value="saida">Saídas</NativeSelectOption>
          <NativeSelectOption value="ajuste">Ajustes</NativeSelectOption>
        </NativeSelect>
      </div>
      <Button type="submit" variant="secondary">
        Filtrar
      </Button>
    </Form>
  );
}
