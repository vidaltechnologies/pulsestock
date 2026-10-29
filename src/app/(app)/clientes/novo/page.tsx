import type { Metadata } from "next";

import { CustomerForm } from "@/components/customers/customer-form";

export const metadata: Metadata = {
  title: "Novo cliente",
};

export default function NewCustomerPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Novo cliente</h1>
      <CustomerForm />
    </div>
  );
}
