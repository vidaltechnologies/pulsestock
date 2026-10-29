import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Suspense } from "react";

import { Badge } from "@/components/ui/badge";
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
import { listCustomers } from "@/lib/data/customers";
import { getI18n } from "@/lib/i18n/server";
import { customerListQuerySchema, formatDocument } from "@/lib/validations/customer";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.meta.customers };
}

const PAGE_SIZE = 20;

// Filtros na URL em português: ?busca=&status=ativos|inativos|todos&pagina=
const STATUS_FROM_URL = { ativos: "active", inativos: "inactive", todos: "all" } as const;

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CustomersPage({ searchParams }: PageProps<"/clientes">) {
  const { t } = await getI18n();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t.meta.customers}</h1>
          <p className="text-sm text-muted-foreground">{t.customers.subtitle}</p>
        </div>
        <Button asChild>
          <Link href="/clientes/novo">
            <Plus aria-hidden />
            {t.customers.newCustomer}
          </Link>
        </Button>
      </div>

      <Suspense fallback={<Skeleton className="h-80 w-full" />}>
        <CustomerList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function CustomerList({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const statusParam = first(params.status) ?? "ativos";
  const status = statusParam in STATUS_FROM_URL ? statusParam : "ativos";
  const query = customerListQuerySchema.parse({
    q: first(params.busca) ?? "",
    status: STATUS_FROM_URL[status as keyof typeof STATUS_FROM_URL],
    page: first(params.pagina) ?? 1,
    pageSize: PAGE_SIZE,
  });

  const [result, { t, f }] = await Promise.all([listCustomers(query), getI18n()]);
  if (result.error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {t.customers.loadError}
      </p>
    );
  }

  const { items, total } = result.data;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function pageHref(page: number) {
    const next = new URLSearchParams();
    if (query.q) next.set("busca", query.q);
    if (status !== "ativos") next.set("status", status);
    if (page > 1) next.set("pagina", String(page));
    const qs = next.toString();
    return qs ? `/clientes?${qs}` : "/clientes";
  }

  return (
    <div className="flex flex-col gap-4">
      <Form action="/clientes" className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-48 flex-1 flex-col gap-1.5">
          <Label htmlFor="busca">{t.common.search}</Label>
          <Input
            id="busca"
            name="busca"
            type="search"
            placeholder={t.customers.searchPlaceholder}
            defaultValue={query.q}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="status">{t.common.status}</Label>
          <NativeSelect id="status" name="status" defaultValue={status}>
            <NativeSelectOption value="ativos">{t.common.activePlural}</NativeSelectOption>
            <NativeSelectOption value="inativos">{t.common.inactivePlural}</NativeSelectOption>
            <NativeSelectOption value="todos">{t.common.all}</NativeSelectOption>
          </NativeSelect>
        </div>
        <Button type="submit" variant="secondary">
          <Search aria-hidden />
          {t.common.filter}
        </Button>
      </Form>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.common.name}</TableHead>
              <TableHead className="hidden sm:table-cell">{t.customers.document}</TableHead>
              <TableHead className="hidden lg:table-cell">{t.customers.contact}</TableHead>
              <TableHead className="hidden md:table-cell">{t.customers.city}</TableHead>
              <TableHead className="hidden sm:table-cell">{t.common.status}</TableHead>
              <TableHead className="sr-only">{t.common.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  {query.q || query.status !== "active"
                    ? t.customers.emptyFiltered
                    : t.customers.empty}
                </TableCell>
              </TableRow>
            ) : (
              items.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="hidden font-mono text-xs sm:table-cell">
                    {c.document ? formatDocument(c.document) : "—"}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">
                    {c.email ?? c.phone ?? "—"}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {c.city ? `${c.city}${c.state ? `/${c.state}` : ""}` : (c.state ?? "—")}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant={c.active ? "secondary" : "outline"}>
                      {c.active ? t.common.active : t.common.inactive}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/clientes/${c.id}`} aria-label={t.common.editItem(c.name)}>
                        {t.common.edit}
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <nav aria-label={t.common.pagination} className="flex items-center justify-between gap-4 text-sm">
        <p className="text-muted-foreground">
          {t.customers.count(total, f.integer(total))}
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
