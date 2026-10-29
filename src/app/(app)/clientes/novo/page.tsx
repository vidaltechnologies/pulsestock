import type { Metadata } from "next";

import { CustomerForm } from "@/components/customers/customer-form";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.meta.newCustomer };
}

export default async function NewCustomerPage() {
  const { t } = await getI18n();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t.meta.newCustomer}</h1>
      <CustomerForm />
    </div>
  );
}
