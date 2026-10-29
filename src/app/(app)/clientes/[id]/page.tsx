import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { CustomerForm } from "@/components/customers/customer-form";
import { StatusToggleButton } from "@/components/status-toggle-button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth";
import { getCustomer } from "@/lib/data/customers";

export const metadata: Metadata = {
  title: "Editar cliente",
};

export default function EditCustomerPage({ params }: PageProps<"/clientes/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full max-w-2xl" />}>
      <EditCustomer params={params} />
    </Suspense>
  );
}

async function EditCustomer({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    notFound();
  }

  const customer = await getCustomer(id);
  if (customer.error?.code === "not_found") {
    notFound();
  }
  if (customer.error) {
    throw new Error("Não foi possível carregar o cliente.");
  }

  const c = customer.data;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{c.name}</h1>
        <Badge variant={c.active ? "secondary" : "outline"}>{c.active ? "Ativo" : "Inativo"}</Badge>
      </div>
      <CustomerForm customer={c} />
      {user.role === "admin" && (
        <div className="max-w-2xl border-t pt-6">
          <StatusToggleButton endpoint={`/api/customers/${c.id}`} active={c.active} noun="cliente" />
        </div>
      )}
    </div>
  );
}
