import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Suspense } from "react";

import { CategoryForm } from "@/components/products/category-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireRole } from "@/lib/auth";
import { listCategories } from "@/lib/data/products";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.meta.categories };
}

export default async function CategoriesPage() {
  const { t } = await getI18n();
  return (
    <div className="flex max-w-xl flex-col gap-6">
      <div className="flex flex-col items-start gap-2">
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href="/produtos">
            <ArrowLeft aria-hidden />
            {t.categories.back}
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">{t.meta.categories}</h1>
      </div>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Categories />
      </Suspense>
    </div>
  );
}

async function Categories() {
  await requireRole("admin");
  const [{ data: categories, error }, { t, f }] = await Promise.all([listCategories(), getI18n()]);
  if (error) {
    throw new Error("Não foi possível carregar as categorias.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {t.categories.count(categories.length, f.integer(categories.length))}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <CategoryForm />
        {categories.length > 0 && (
          <ul className="divide-y rounded-md border text-sm">
            {categories.map((category) => (
              <li key={category.id} className="px-3 py-2">
                {category.name}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
