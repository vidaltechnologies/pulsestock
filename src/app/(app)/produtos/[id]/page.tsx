import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { ProductForm } from "@/components/products/product-form";
import { StatusToggleButton } from "@/components/status-toggle-button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { requireRole } from "@/lib/auth";
import { getProduct, listCategories } from "@/lib/data/products";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.meta.editProduct };
}

export default function EditProductPage({ params }: PageProps<"/produtos/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full max-w-2xl" />}>
      <EditProduct params={params} />
    </Suspense>
  );
}

async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    notFound();
  }

  const [product, categories, { t, f }] = await Promise.all([
    getProduct(id),
    listCategories(),
    getI18n(),
  ]);
  if (product.error?.code === "not_found") {
    notFound();
  }
  if (product.error || categories.error) {
    throw new Error("Não foi possível carregar o produto.");
  }

  const p = product.data;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{p.name}</h1>
          <Badge variant={p.active ? "secondary" : "outline"}>
            {p.active ? t.common.active : t.common.inactive}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {t.products.currentStock(f.integer(p.stockQuantity), p.unit)}{" "}
          <Link
            href={`/estoque?produto=${p.id}`}
            className="text-primary underline underline-offset-4"
          >
            {t.products.stockMovements}
          </Link>
          .
        </p>
      </div>
      <ProductForm product={p} categories={categories.data} />
      <div className="max-w-2xl border-t pt-6">
        <StatusToggleButton endpoint={`/api/v1/products/${p.id}`} active={p.active} noun={t.products.noun} />
      </div>
    </div>
  );
}
