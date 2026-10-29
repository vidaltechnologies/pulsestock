import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { Suspense } from "react";
import { z } from "zod";

import { OrderStatusActions } from "@/components/orders/order-status-actions";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireUser } from "@/lib/auth";
import { getOrder } from "@/lib/data/orders";
import { getI18n } from "@/lib/i18n/server";
import { formatDocument } from "@/lib/validations/customer";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.meta.order };
}

export default function OrderPage({ params }: PageProps<"/pedidos/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <OrderDetail params={params} />
    </Suspense>
  );
}

async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    notFound();
  }

  const [user, result, { t, f }] = await Promise.all([requireUser(), getOrder(id), getI18n()]);
  if (result.error?.code === "not_found") {
    notFound();
  }
  if (result.error) {
    throw new Error("Não foi possível carregar o pedido.");
  }
  const order = result.data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-start gap-2">
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href="/pedidos">
            <ArrowLeft aria-hidden />
            {t.orders.back}
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{t.orders.title(order.number)}</h1>
          <OrderStatusBadge status={order.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          {t.orders.createdAt(f.dateTime(order.createdAt))}
          {order.createdBy.name && t.orders.createdBy(order.createdBy.name)}
          {order.confirmedAt && t.orders.confirmedAt(f.dateTime(order.confirmedAt))}
        </p>
      </div>

      <div className="flex flex-wrap items-start gap-3">
        <OrderStatusActions orderId={order.id} status={order.status} isAdmin={user.role === "admin"} />
        {order.status === "pending" && (
          <Button asChild variant="outline">
            <Link href={`/pedidos/${order.id}/editar`}>
              <Pencil aria-hidden />
              {t.orders.editItems}
            </Link>
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.common.product}</TableHead>
                <TableHead className="text-right">{t.common.qty}</TableHead>
                <TableHead className="hidden text-right sm:table-cell">{t.common.price}</TableHead>
                <TableHead className="text-right">{t.common.subtotal}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <span className="font-medium">{item.product.name}</span>
                    <span className="block font-mono text-xs text-muted-foreground">{item.product.sku}</span>
                    {order.status === "pending" && item.quantity > item.product.stockQuantity && (
                      <span className="block text-xs text-amber-700 dark:text-amber-300">
                        {t.common.currentStock(f.integer(item.product.stockQuantity), item.product.unit)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {f.integer(item.quantity)} {item.product.unit}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">
                    {f.currency(item.unitPrice)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{f.currency(item.subtotal)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="font-medium">
                  {t.common.total}
                </TableCell>
                <TableCell className="hidden sm:table-cell" />
                <TableCell className="text-right font-semibold tabular-nums">
                  {f.currency(order.totalAmount)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.common.customer}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1 text-sm">
              <Link href={`/clientes/${order.customer.id}`} className="font-medium hover:underline">
                {order.customer.name}
              </Link>
              {order.customer.document && (
                <span className="font-mono text-xs text-muted-foreground">
                  {formatDocument(order.customer.document)}
                </span>
              )}
              {order.customer.email && <span className="text-muted-foreground">{order.customer.email}</span>}
              {order.customer.phone && <span className="text-muted-foreground">{order.customer.phone}</span>}
            </CardContent>
          </Card>
          {order.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t.orders.notes}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm whitespace-pre-line">{order.notes}</CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
