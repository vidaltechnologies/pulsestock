import { z } from "zod";

// Períodos do dashboard, em dias. Valor fora da lista cai em 30.
export const DASHBOARD_PERIODS = [7, 30, 90] as const;
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

export const dashboardQuerySchema = z.object({
  days: z.coerce
    .number()
    .refine((v): v is DashboardPeriod => (DASHBOARD_PERIODS as readonly number[]).includes(v))
    .catch(30),
});

export type DashboardQuery = { days: DashboardPeriod };
