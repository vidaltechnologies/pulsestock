import { Badge } from "@/components/ui/badge";
import { getI18n } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/lib/validations/order";

const STYLES: Record<OrderStatus, string> = {
  pending: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200",
  confirmed: "border-transparent bg-primary/10 text-primary",
  shipped: "border-transparent bg-brand-teal/15 text-teal-800 dark:text-teal-200",
  delivered: "border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  cancelled: "border-border bg-transparent text-muted-foreground",
};

export async function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { t } = await getI18n();
  return (
    <Badge variant="outline" className={cn(STYLES[status])}>
      {t.orders.statuses[status]}
    </Badge>
  );
}
