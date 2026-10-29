import type { Metadata } from "next";
import { Suspense } from "react";

import { ProductForm } from "@/components/products/product-form";
import { Skeleton } from "@/components/ui/skeleton";
import { requireRole } from "@/lib/auth";
import { listCategories } from "@/lib/data/products";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.meta.newProduct };
}

export default async function NewProductPage() {
  const { t } = await getI18n();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t.meta.newProduct}</h1>
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
