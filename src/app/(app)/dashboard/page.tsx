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
import { listLowStockProducts, type DataResult, type Product } from "@/lib/data/products";
import { getI18n } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";
import { DASHBOARD_PERIODS, dashboardQuerySchema } from "@/lib/validations/dashboard";
import { ORDER_STATUSES } from "@/lib/validations/order";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.meta.dashboard };
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
  const [user, days, { t }] = await Promise.all([requireUser(), periodFrom(searchParams), getI18n()]);
  const firstName = (user.fullName || user.email).split(" ")[0];

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t.dashboard.greeting(firstName)}</h1>
        <p className="text-sm text-muted-foreground">{t.dashboard.salesNote}</p>
      </div>
      <nav aria-label={t.dashboard.periodNav} className="flex w-fit rounded-lg border p-1">
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
            {t.dashboard.days(period)}
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
  const [{ data, error }, user, { t, f }] = await Promise.all([
    getDashboard(days),
    requireUser(),
    getI18n(),
  ]);

  if (error) {
    return (
      <p
        role="alert"
        className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
      >
        {t.dashboard.loadError}
      </p>
    );
  }

  const month = f.month(data.monthStart);
  const periodLabel = t.dashboard.period(f.day(data.periodStart), f.day(data.today));
  // Margem e estoque a custo: só o admin recebe os valores do banco.
  const showCost = user.role === "admin" && data.monthMargin !== null && data.stockValue !== null;

  return (
    <>
      <section
        aria-label={t.dashboard.monthIndicators}
        className={cn(
          "grid grid-cols-2 gap-3 sm:gap-4",
          showCost ? "xl:grid-cols-3" : "xl:grid-cols-4",
        )}
      >
        <StatTile label={t.dashboard.monthSales(month)} value={f.currency(data.monthSales)} hero />
        <StatTile label={t.dashboard.monthOrders} value={f.integer(data.monthOrders)} />
        <StatTile label={t.dashboard.averageTicket} value={f.currency(data.averageTicket)} />
        <StatTile
          label={t.dashboard.pendingOrders}
          value={f.integer(data.pendingOrders)}
          href="/pedidos?status=pendente"
          linkLabel={t.dashboard.viewOrders}
        />
        {showCost && (
          <>
            <StatTile
              label={t.dashboard.monthMargin}
              value={f.currency(data.monthMargin ?? 0)}
              note={t.dashboard.marginNote}
            />
            <StatTile
              label={t.dashboard.stockValue}
              value={f.currency(data.stockValue ?? 0)}
              note={t.dashboard.stockValueNote}
            />
          </>
        )}
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.dashboard.salesByDay}</CardTitle>
          <CardDescription>{periodLabel}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {data.salesByDay.some((d) => d.total > 0) ? (
            <SalesByDayChart data={data.salesByDay} />
          ) : (
            <EmptyChart>{t.dashboard.noSales}</EmptyChart>
          )}
          <SalesTable data={data} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.dashboard.topProducts}</CardTitle>
            <CardDescription>{t.dashboard.topProductsDescription(periodLabel)}</CardDescription>
          </CardHeader>
          <CardContent>
            {data.topProducts.length > 0 ? (
              <HorizontalBarChart
                format="currency"
                data={data.topProducts.map((p) => ({
                  label: p.name,
                  value: p.total,
                  detail: `${f.integer(p.quantity)} ${p.unit} · ${p.sku}`,
                }))}
              />
            ) : (
              <EmptyChart>{t.dashboard.noProductsSold}</EmptyChart>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.dashboard.ordersByStatus}</CardTitle>
            <CardDescription>{t.dashboard.ordersByStatusDescription(periodLabel)}</CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(data.ordersByStatus).length > 0 ? (
              <HorizontalBarChart
                format="integer"
                data={ORDER_STATUSES.map((status) => ({
                  label: t.orders.statuses[status],
                  value: data.ordersByStatus[status] ?? 0,
                }))}
              />
            ) : (
              <EmptyChart>{t.dashboard.noOrders}</EmptyChart>
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
async function SalesTable({ data }: { data: Dashboard }) {
  const { t, f } = await getI18n();
  const days = data.salesByDay.filter((d) => d.orders > 0);
  return (
    <details className="text-sm">
      <summary className="w-fit cursor-pointer text-muted-foreground hover:text-foreground">
        {t.dashboard.viewTable}
      </summary>
      {days.length === 0 ? (
        <p className="mt-2 text-muted-foreground">{t.dashboard.noSales}</p>
      ) : (
        <Table className="mt-2">
          <TableHeader>
            <TableRow>
              <TableHead>{t.dashboard.day}</TableHead>
              <TableHead className="text-right">{t.dashboard.ordersColumn}</TableHead>
              <TableHead className="text-right">{t.dashboard.salesColumn}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {days.map((d) => (
              <TableRow key={d.day}>
                <TableCell>{f.day(d.day)}</TableCell>
                <TableCell className="text-right tabular-nums">{f.integer(d.orders)}</TableCell>
                <TableCell className="text-right tabular-nums">{f.currency(d.total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </details>
  );
}

async function LowStockList({ count }: { count: number }) {
  const [{ data: products, error }, { t, f }] = await Promise.all([
    count > 0 ? listLowStockProducts() : ({ data: [] } as DataResult<Product[]>),
    getI18n(),
  ]);
  if (error) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t.dashboard.lowStock(f.integer(count))}</CardTitle>
        <CardDescription>{t.dashboard.lowStockDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        {products.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.dashboard.noLowStock}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.common.product}</TableHead>
                <TableHead className="text-right">{t.dashboard.balance}</TableHead>
                <TableHead className="text-right">{t.dashboard.minimum}</TableHead>
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
                    {f.integer(p.stockQuantity)} {p.unit}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {f.integer(p.minStock)}
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
            {t.dashboard.viewAllProducts(f.integer(products.length))}
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
