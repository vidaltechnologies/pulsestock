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
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.meta.editCustomer };
}

export default function EditCustomerPage({ params }: PageProps<"/clientes/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full max-w-2xl" />}>
      <EditCustomer params={params} />
    </Suspense>
  );
}

async function EditCustomer({ params }: { params: Promise<{ id: string }> }) {
  const [user, { t }] = await Promise.all([requireUser(), getI18n()]);
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
        <Badge variant={c.active ? "secondary" : "outline"}>{c.active ? t.common.active : t.common.inactive}</Badge>
      </div>
      <CustomerForm customer={c} />
      {user.role === "admin" && (
        <div className="max-w-2xl border-t pt-6">
          <StatusToggleButton endpoint={`/api/v1/customers/${c.id}`} active={c.active} noun={t.customers.noun} />
        </div>
      )}
    </div>
  );
}
