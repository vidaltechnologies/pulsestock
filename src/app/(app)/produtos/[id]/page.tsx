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
import { formatInteger } from "@/lib/format";

export const metadata: Metadata = {
  title: "Editar produto",
};

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

  const [product, categories] = await Promise.all([getProduct(id), listCategories()]);
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
          <Badge variant={p.active ? "secondary" : "outline"}>{p.active ? "Ativo" : "Inativo"}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Saldo atual: {formatInteger(p.stockQuantity)} {p.unit}. O saldo muda pelas{" "}
          <Link href={`/estoque?produto=${p.id}`} className="text-primary underline-offset-4 hover:underline">
            movimentações de estoque
          </Link>
          .
        </p>
      </div>
      <ProductForm product={p} categories={categories.data} />
      <div className="max-w-2xl border-t pt-6">
        <StatusToggleButton endpoint={`/api/products/${p.id}`} active={p.active} noun="produto" />
      </div>
    </div>
  );
}
