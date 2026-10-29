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
import { formatCurrency, formatInteger } from "@/lib/format";
import { formatDocument } from "@/lib/validations/customer";

export const metadata: Metadata = {
  title: "Pedido",
};

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

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

  const [user, result] = await Promise.all([requireUser(), getOrder(id)]);
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
            Pedidos
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Pedido #{order.number}</h1>
          <OrderStatusBadge status={order.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          Criado em {dateTime.format(new Date(order.createdAt))}
          {order.createdBy.name && ` por ${order.createdBy.name}`}
          {order.confirmedAt && ` · confirmado em ${dateTime.format(new Date(order.confirmedAt))}`}
        </p>
      </div>

      <div className="flex flex-wrap items-start gap-3">
        <OrderStatusActions orderId={order.id} status={order.status} isAdmin={user.role === "admin"} />
        {order.status === "pending" && (
          <Button asChild variant="outline">
            <Link href={`/pedidos/${order.id}/editar`}>
              <Pencil aria-hidden />
              Editar itens
            </Link>
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Qtd.</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Preço</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
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
                        Saldo atual: {formatInteger(item.product.stockQuantity)} {item.product.unit}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatInteger(item.quantity)} {item.product.unit}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">
                    {formatCurrency(item.unitPrice)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(item.subtotal)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="font-medium">
                  Total
                </TableCell>
                <TableCell className="hidden sm:table-cell" />
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatCurrency(order.totalAmount)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cliente</CardTitle>
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
                <CardTitle className="text-base">Observações</CardTitle>
              </CardHeader>
              <CardContent className="text-sm whitespace-pre-line">{order.notes}</CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
