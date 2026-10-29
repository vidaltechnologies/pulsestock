import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { OrderForm } from "@/components/orders/order-form";
import { Skeleton } from "@/components/ui/skeleton";
import { listCustomerOptions } from "@/lib/data/customers";
import { getOrder } from "@/lib/data/orders";
import { listProductOptions } from "@/lib/data/products";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.meta.editOrder };
}

export default function EditOrderPage({ params }: PageProps<"/pedidos/[id]/editar">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full max-w-4xl" />}>
      <EditOrder params={params} />
    </Suspense>
  );
}

async function EditOrder({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    notFound();
  }

  const [order, customers, products, { t }] = await Promise.all([
    getOrder(id),
    listCustomerOptions(),
    listProductOptions(),
    getI18n(),
  ]);
  if (order.error?.code === "not_found") {
    notFound();
  }
  if (order.error) {
    throw new Error("Não foi possível carregar o pedido.");
  }
  // Só pedido pendente é editado.
  if (order.data.status !== "pending") {
    redirect(`/pedidos/${id}`);
  }

  // O cliente do pedido pode ter sido inativado depois: mantém na lista.
  const active = customers.data ?? [];
  const customerOptions = active.some((c) => c.id === order.data.customer.id)
    ? active
    : [
        {
          id: order.data.customer.id,
          name: t.orders.inactiveCustomer(order.data.customer.name),
          document: order.data.customer.document,
        },
        ...active,
      ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t.orders.editTitle(order.data.number)}</h1>
      <OrderForm order={order.data} customers={customerOptions} products={products.data ?? []} />
    </div>
  );
}
