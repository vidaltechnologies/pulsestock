import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Tags } from "lucide-react";
import { Suspense } from "react";

import { ProductFilters } from "@/components/products/product-filters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { listCategories, listProducts } from "@/lib/data/products";
import { formatCurrency, formatInteger } from "@/lib/format";
import { productListQuerySchema } from "@/lib/validations/product";

export const metadata: Metadata = {
  title: "Produtos",
};

const PAGE_SIZE = 20;

// Filtros na URL em português: ?busca=&categoria=&status=ativos|inativos|todos&pagina=
const STATUS_FROM_URL = { ativos: "active", inativos: "inactive", todos: "all" } as const;

type SearchParams = Record<string, string | string[] | undefined>;

export default function ProductsPage({ searchParams }: PageProps<"/produtos">) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Produtos</h1>
          <p className="text-sm text-muted-foreground">Catálogo, preços e saldo em estoque.</p>
        </div>
        <Suspense>
          <AdminActions />
        </Suspense>
      </div>

      <Suspense fallback={<ListSkeleton />}>
        <ProductList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function AdminActions() {
  const user = await requireUser();
  if (user.role !== "admin") {
    return null;
  }
  return (
    <div className="flex gap-2">
      <Button asChild variant="outline">
        <Link href="/produtos/categorias">
          <Tags aria-hidden />
          Categorias
        </Link>
      </Button>
      <Button asChild>
        <Link href="/produtos/novo">
          <Plus aria-hidden />
          Novo produto
        </Link>
      </Button>
    </div>
  );
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function ProductList({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const user = await requireUser();
  const statusParam = first(params.status) ?? "ativos";
  const query = productListQuerySchema.parse({
    q: first(params.busca) ?? "",
    categoryId: first(params.categoria) || undefined,
    status: STATUS_FROM_URL[statusParam as keyof typeof STATUS_FROM_URL],
    page: first(params.pagina) ?? 1,
    pageSize: PAGE_SIZE,
  });

  const [products, categories] = await Promise.all([listProducts(query), listCategories()]);
  if (products.error || categories.error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        Não foi possível carregar os produtos. Recarregue a página.
      </p>
    );
  }

  const { items, total } = products.data;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isAdmin = user.role === "admin";

  function pageHref(page: number) {
    const next = new URLSearchParams();
    if (query.q) next.set("busca", query.q);
    if (query.categoryId) next.set("categoria", query.categoryId);
    if (statusParam !== "ativos") next.set("status", statusParam);
    if (page > 1) next.set("pagina", String(page));
    const qs = next.toString();
    return qs ? `/produtos?${qs}` : "/produtos";
  }

  return (
    <div className="flex flex-col gap-4">
      <ProductFilters
        categories={categories.data}
        defaults={{
          busca: query.q,
          categoria: query.categoryId ?? "",
          status: statusParam in STATUS_FROM_URL ? statusParam : "ativos",
        }}
      />

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead className="hidden md:table-cell">Categoria</TableHead>
              <TableHead className="text-right">Preço de venda</TableHead>
              <TableHead className="text-right">Estoque</TableHead>
              <TableHead className="hidden sm:table-cell">Status</TableHead>
              {isAdmin && <TableHead className="sr-only">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 7 : 6} className="py-10 text-center text-muted-foreground">
                  {query.q || query.categoryId || query.status !== "active"
                    ? "Nenhum produto encontrado com esses filtros."
                    : "Nenhum produto cadastrado ainda."}
                </TableCell>
              </TableRow>
            ) : (
              items.map((product) => {
                return (
                  <TableRow key={product.id}>
                    <TableCell className="font-mono text-xs">{product.sku}</TableCell>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {product.category?.name ?? "Sem categoria"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(product.salePrice)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span className="inline-flex items-center gap-2">
                        {product.lowStock && <Badge variant="destructive">Baixo</Badge>}
                        {formatInteger(product.stockQuantity)} {product.unit}
                      </span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant={product.active ? "secondary" : "outline"}>
                        {product.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/produtos/${product.id}`} aria-label={`Editar ${product.name}`}>
                            Editar
                          </Link>
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <nav aria-label="Paginação" className="flex items-center justify-between gap-4 text-sm">
        <p className="text-muted-foreground">
          {total === 1 ? "1 produto" : `${formatInteger(total)} produtos`}
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

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-9 w-full max-w-xl" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
