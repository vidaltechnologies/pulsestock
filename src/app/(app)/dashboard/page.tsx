import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { HorizontalBarChart, SalesByDayChart } from "@/components/dashboard/charts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { getDashboard, type Dashboard } from "@/lib/data/dashboard";
import { listLowStockProducts } from "@/lib/data/products";
import { formatCurrency, formatInteger } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DASHBOARD_PERIODS, dashboardQuerySchema } from "@/lib/validations/dashboard";
import { ORDER_STATUSES, ORDER_STATUS_LABELS } from "@/lib/validations/order";

export const metadata: Metadata = {
  title: "Dashboard",
};

const monthName = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" });

// "2026-10-29" → "29/10/2026"
function formatDay(day: string) {
  return day.split("-").reverse().join("/");
}

export default function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<Skeleton className="h-9 w-64" />}>
        <Header searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function periodFrom(searchParams: PageProps<"/dashboard">["searchParams"]) {
  const params = await searchParams;
  const value = Array.isArray(params.periodo) ? params.periodo[0] : params.periodo;
  return dashboardQuerySchema.parse({ days: value }).days;
}

async function Header({ searchParams }: { searchParams: PageProps<"/dashboard">["searchParams"] }) {
  const [user, days] = await Promise.all([requireUser(), periodFrom(searchParams)]);
  const firstName = (user.fullName || user.email).split(" ")[0];

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Olá, {firstName}</h1>
        <p className="text-sm text-muted-foreground">
          Vendas são pedidos confirmados, enviados ou entregues, pela data de confirmação.
        </p>
      </div>
      <nav aria-label="Período dos gráficos" className="flex w-fit rounded-lg border p-1">
        {DASHBOARD_PERIODS.map((period) => (
          <Link
            key={period}
            href={period === 30 ? "/dashboard" : `/dashboard?periodo=${period}`}
            aria-current={period === days ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
              period === days && "bg-muted text-foreground",
            )}
          >
            {period} dias
          </Link>
        ))}
      </nav>
    </div>
  );
}

async function DashboardContent({
  searchParams,
}: {
  searchParams: PageProps<"/dashboard">["searchParams"];
}) {
  const days = await periodFrom(searchParams);
  const [{ data, error }, user] = await Promise.all([getDashboard(days), requireUser()]);

  if (error) {
    return (
      <p
        role="alert"
        className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
      >
        Não foi possível carregar os indicadores. Tente de novo.
      </p>
    );
  }

  const month = monthName.format(new Date(`${data.monthStart}T00:00:00Z`));
  const periodLabel = `${formatDay(data.periodStart)} a ${formatDay(data.today)}`;
  // Margem e estoque a custo: só o admin recebe os valores do banco.
  const showCost = user.role === "admin" && data.monthMargin !== null && data.stockValue !== null;

  return (
    <>
      <section
        aria-label="Indicadores do mês"
        className={cn(
          "grid grid-cols-2 gap-3 sm:gap-4",
          showCost ? "xl:grid-cols-3" : "xl:grid-cols-4",
        )}
      >
        <StatTile label={`Vendas em ${month}`} value={formatCurrency(data.monthSales)} hero />
        <StatTile label="Pedidos vendidos no mês" value={formatInteger(data.monthOrders)} />
        <StatTile label="Ticket médio no mês" value={formatCurrency(data.averageTicket)} />
        <StatTile
          label="Pedidos pendentes"
          value={formatInteger(data.pendingOrders)}
          href="/pedidos?status=pendente"
          linkLabel="Ver pedidos"
        />
        {showCost && (
          <>
            <StatTile
              label="Margem estimada no mês"
              value={formatCurrency(data.monthMargin ?? 0)}
              note="Pelo preço de custo atual dos produtos"
            />
            <StatTile
              label="Estoque a preço de custo"
              value={formatCurrency(data.stockValue ?? 0)}
              note="Produtos ativos"
            />
          </>
        )}
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vendas por dia</CardTitle>
          <CardDescription>{periodLabel}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {data.salesByDay.some((d) => d.total > 0) ? (
            <SalesByDayChart data={data.salesByDay} />
          ) : (
            <EmptyChart>Nenhuma venda no período.</EmptyChart>
          )}
          <SalesTable data={data} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mais vendidos</CardTitle>
            <CardDescription>Valor vendido por produto, {periodLabel}</CardDescription>
          </CardHeader>
          <CardContent>
            {data.topProducts.length > 0 ? (
              <HorizontalBarChart
                format="currency"
                data={data.topProducts.map((p) => ({
                  label: p.name,
                  value: p.total,
                  detail: `${formatInteger(p.quantity)} ${p.unit} · ${p.sku}`,
                }))}
              />
            ) : (
              <EmptyChart>Nenhum produto vendido no período.</EmptyChart>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pedidos por status</CardTitle>
            <CardDescription>Pedidos criados de {periodLabel}</CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(data.ordersByStatus).length > 0 ? (
              <HorizontalBarChart
                format="integer"
                data={ORDER_STATUSES.map((status) => ({
                  label: ORDER_STATUS_LABELS[status],
                  value: data.ordersByStatus[status] ?? 0,
                }))}
              />
            ) : (
              <EmptyChart>Nenhum pedido criado no período.</EmptyChart>
            )}
          </CardContent>
        </Card>
      </div>

      <Suspense fallback={<Skeleton className="h-40 w-full" />}>
        <LowStockList count={data.lowStockProducts} />
      </Suspense>
    </>
  );
}

function StatTile({
  label,
  value,
  note,
  href,
  linkLabel,
  hero = false,
}: {
  label: string;
  value: string;
  note?: string;
  href?: string;
  linkLabel?: string;
  hero?: boolean;
}) {
  return (
    <Card className="gap-2 py-4 sm:py-5">
      <CardContent className="flex flex-col gap-1 px-4 sm:px-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p
          className={cn(
            "font-semibold tabular-nums tracking-tight",
            hero ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl",
          )}
        >
          {value}
        </p>
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
        {href && (
          <Link href={href} className="w-fit text-xs font-medium text-primary hover:underline">
            {linkLabel}
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyChart({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex h-32 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
      {children}
    </p>
  );
}

// Os mesmos números do gráfico em tabela, para leitor de tela e conferência.
function SalesTable({ data }: { data: Dashboard }) {
  const days = data.salesByDay.filter((d) => d.orders > 0);
  return (
    <details className="text-sm">
      <summary className="w-fit cursor-pointer text-muted-foreground hover:text-foreground">
        Ver dados em tabela
      </summary>
      {days.length === 0 ? (
        <p className="mt-2 text-muted-foreground">Nenhuma venda no período.</p>
      ) : (
        <Table className="mt-2">
          <TableHeader>
            <TableRow>
              <TableHead>Dia</TableHead>
              <TableHead className="text-right">Pedidos</TableHead>
              <TableHead className="text-right">Vendas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {days.map((d) => (
              <TableRow key={d.day}>
                <TableCell>{formatDay(d.day)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatInteger(d.orders)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(d.total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </details>
  );
}

async function LowStockList({ count }: { count: number }) {
  const { data: products, error } = count > 0 ? await listLowStockProducts() : { data: [] };
  if (error) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Estoque baixo: {formatInteger(count)}</CardTitle>
        <CardDescription>Produtos ativos no estoque mínimo ou abaixo dele</CardDescription>
      </CardHeader>
      <CardContent>
        {products.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum produto abaixo do mínimo.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead className="text-right">Mínimo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.slice(0, 5).map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <span className="font-medium">{p.name}</span>
                    <span className="block font-mono text-xs text-muted-foreground">{p.sku}</span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatInteger(p.stockQuantity)} {p.unit}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatInteger(p.minStock)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {products.length > 5 && (
          <Link
            href="/estoque"
            className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
          >
            Ver todos os {formatInteger(products.length)} produtos
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-80" />
    </div>
  );
}
