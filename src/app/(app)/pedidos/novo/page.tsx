import type { Metadata } from "next";
import { Suspense } from "react";

import { OrderForm } from "@/components/orders/order-form";
import { Skeleton } from "@/components/ui/skeleton";
import { listCustomerOptions } from "@/lib/data/customers";
import { listProductOptions } from "@/lib/data/products";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.meta.newOrder };
}

export default async function NewOrderPage() {
  const { t } = await getI18n();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t.meta.newOrder}</h1>
      <Suspense fallback={<Skeleton className="h-96 w-full max-w-4xl" />}>
        <NewOrder />
      </Suspense>
    </div>
  );
}

async function NewOrder() {
  const [customers, products] = await Promise.all([listCustomerOptions(), listProductOptions()]);
  return <OrderForm customers={customers.data ?? []} products={products.data ?? []} />;
}
