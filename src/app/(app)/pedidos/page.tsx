import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Suspense } from "react";

import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { listOrders } from "@/lib/data/orders";
import { formatCurrency, formatInteger } from "@/lib/format";
import { ORDER_STATUS_LABELS, ORDER_STATUSES, orderListQuerySchema } from "@/lib/validations/order";

export const metadata: Metadata = {
  title: "Pedidos",
};

const PAGE_SIZE = 20;

// Filtros na URL em português: ?busca=&status=pendente|confirmado|...&pagina=
const STATUS_FROM_URL = {
  pendente: "pending",
  confirmado: "confirmed",
  enviado: "shipped",
  entregue: "delivered",
  cancelado: "cancelled",
} as const;
const STATUS_TO_URL = Object.fromEntries(Object.entries(STATUS_FROM_URL).map(([k, v]) => [v, k]));

const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" });

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function OrdersPage({ searchParams }: PageProps<"/pedidos">) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pedidos</h1>
          <p className="text-sm text-muted-foreground">
            Pedidos de venda. O estoque baixa quando o pedido é confirmado.
          </p>
        </div>
        <Button asChild>
          <Link href="/pedidos/novo">
            <Plus aria-hidden />
            Novo pedido
          </Link>
        </Button>
      </div>

      <Suspense fallback={<Skeleton className="h-80 w-full" />}>
        <OrderList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function OrderList({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const statusParam = first(params.status) ?? "";
  const query = orderListQuerySchema.parse({
    q: first(params.busca) ?? "",
    status: STATUS_FROM_URL[statusParam as keyof typeof STATUS_FROM_URL],
    customerId: first(params.cliente) || undefined,
    page: first(params.pagina) ?? 1,
    pageSize: PAGE_SIZE,
  });

  const result = await listOrders(query);
  if (result.error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        Não foi possível carregar os pedidos. Recarregue a página.
      </p>
    );
  }

  const { items, total } = result.data;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function pageHref(page: number) {
    const next = new URLSearchParams();
    if (query.q) next.set("busca", query.q);
    if (query.status) next.set("status", STATUS_TO_URL[query.status]);
    if (query.customerId) next.set("cliente", query.customerId);
    if (page > 1) next.set("pagina", String(page));
    const qs = next.toString();
    return qs ? `/pedidos?${qs}` : "/pedidos";
  }

  return (
    <div className="flex flex-col gap-4">
      <Form action="/pedidos" className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-48 flex-1 flex-col gap-1.5">
          <Label htmlFor="busca">Buscar</Label>
          <Input
            id="busca"
            name="busca"
            type="search"
            placeholder="Número do pedido ou nome do cliente"
            defaultValue={query.q}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="status">Status</Label>
          <NativeSelect id="status" name="status" defaultValue={query.status ? STATUS_TO_URL[query.status] : ""}>
            <NativeSelectOption value="">Todos</NativeSelectOption>
            {ORDER_STATUSES.map((s) => (
              <NativeSelectOption key={s} value={STATUS_TO_URL[s]}>
                {ORDER_STATUS_LABELS[s]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <Button type="submit" variant="secondary">
          <Search aria-hidden />
          Filtrar
        </Button>
      </Form>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Nº</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="hidden sm:table-cell">Data</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  {query.q || query.status || query.customerId
                    ? "Nenhum pedido encontrado com esses filtros."
                    : "Nenhum pedido criado ainda."}
                </TableCell>
              </TableRow>
            ) : (
              items.map((o) => (
                <TableRow key={o.id} className="relative">
                  <TableCell className="font-mono text-sm">
                    <Link href={`/pedidos/${o.id}`} className="after:absolute after:inset-0 hover:underline">
                      #{o.number}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">{o.customer.name}</TableCell>
                  <TableCell className="hidden text-muted-foreground tabular-nums sm:table-cell">
                    {date.format(new Date(o.createdAt))}
                  </TableCell>
                  <TableCell>
                    <OrderStatusBadge status={o.status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(o.totalAmount)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <nav aria-label="Paginação" className="flex items-center justify-between gap-4 text-sm">
        <p className="text-muted-foreground">
          {total === 1 ? "1 pedido" : `${formatInteger(total)} pedidos`}
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
