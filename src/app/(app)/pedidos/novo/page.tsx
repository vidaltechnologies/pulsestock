import type { Metadata } from "next";
import { Suspense } from "react";

import { OrderForm } from "@/components/orders/order-form";
import { Skeleton } from "@/components/ui/skeleton";
import { listCustomerOptions } from "@/lib/data/customers";
import { listProductOptions } from "@/lib/data/products";

export const metadata: Metadata = {
  title: "Novo pedido",
};

export default function NewOrderPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Novo pedido</h1>
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
