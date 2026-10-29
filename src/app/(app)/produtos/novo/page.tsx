import type { Metadata } from "next";
import { Suspense } from "react";

import { ProductForm } from "@/components/products/product-form";
import { Skeleton } from "@/components/ui/skeleton";
import { requireRole } from "@/lib/auth";
import { listCategories } from "@/lib/data/products";

export const metadata: Metadata = {
  title: "Novo produto",
};

export default function NewProductPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Novo produto</h1>
      <Suspense fallback={<Skeleton className="h-96 w-full max-w-2xl" />}>
        <NewProduct />
      </Suspense>
    </div>
  );
}

async function NewProduct() {
  await requireRole("admin");
  const { data: categories } = await listCategories();
  return <ProductForm categories={categories ?? []} />;
}
