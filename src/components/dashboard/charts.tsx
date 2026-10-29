"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatCurrency, formatInteger } from "@/lib/format";

// Gráficos do dashboard. Uma série por gráfico, na cor --chart-1 (azul da
// marca, ajustado para o tema escuro); textos e eixos usam as cores de texto.

const SERIES = "var(--chart-1)";
const GRID = "var(--border)";
const AXIS_TEXT = { fill: "var(--muted-foreground)", fontSize: 12 };

const compactCurrency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

// "2026-10-29" → "29/10", sem passar por Date (evita diferença de fuso).
function shortDay(day: string) {
  const [, month, date] = day.split("-");
  return `${date}/${month}`;
}

function TooltipBox({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="font-medium">{title}</p>
      {lines.map((line) => (
        <p key={line} className="text-muted-foreground">
          {line}
        </p>
      ))}
    </div>
  );
}

// O que os tooltips usam das props que o Recharts passa.
type TooltipProps = { active?: boolean; payload?: ReadonlyArray<{ payload?: unknown }> };

type SalesPoint = { day: string; total: number; orders: number };

function SalesTooltip({ active, payload }: TooltipProps) {
  const point = payload?.[0]?.payload as SalesPoint | undefined;
  if (!active || !point) {
    return null;
  }
  return (
    <TooltipBox
      title={shortDay(point.day)}
      lines={[
        formatCurrency(point.total),
        `${formatInteger(point.orders)} ${point.orders === 1 ? "pedido" : "pedidos"}`,
      ]}
    />
  );
}

export function SalesByDayChart({ data }: { data: SalesPoint[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis
            dataKey="day"
            tickFormatter={shortDay}
            tick={AXIS_TEXT}
            tickLine={false}
            axisLine={{ stroke: GRID }}
            minTickGap={24}
          />
          <YAxis
            tickFormatter={(v: number) => compactCurrency.format(v)}
            tick={AXIS_TEXT}
            tickLine={false}
            axisLine={false}
            width={72}
            allowDecimals={false}
          />
          <Tooltip
            content={SalesTooltip}
            cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
          />
          <Area
            type="linear"
            dataKey="total"
            stroke={SERIES}
            strokeWidth={2}
            fill={SERIES}
            fillOpacity={0.1}
            dot={false}
            activeDot={{ r: 5, fill: SERIES, stroke: "var(--card)", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// Rótulo do eixo em uma linha só, cortado com "…" (o Recharts quebraria em duas).
function CategoryTick({
  x,
  y,
  payload,
}: {
  x?: number | string;
  y?: number | string;
  payload?: { value?: string };
}) {
  const label = String(payload?.value ?? "");
  return (
    <text x={Number(x)} y={Number(y)} dx={-6} dy={4} textAnchor="end" {...AXIS_TEXT}>
      <title>{label}</title>
      {label.length > 18 ? `${label.slice(0, 17)}…` : label}
    </text>
  );
}

type BarRow = { label: string; value: number; detail?: string };

function BarTooltip({ active, payload }: TooltipProps) {
  const row = payload?.[0]?.payload as (BarRow & { formatted: string }) | undefined;
  if (!active || !row) {
    return null;
  }
  return (
    <TooltipBox title={row.label} lines={[row.formatted, ...(row.detail ? [row.detail] : [])]} />
  );
}

// Barras horizontais com o valor na ponta. `format` formata o valor.
export function HorizontalBarChart({
  data,
  format,
}: {
  data: BarRow[];
  format: "currency" | "integer";
}) {
  const fmt = format === "currency" ? formatCurrency : formatInteger;
  const rows = data.map((row) => ({ ...row, formatted: fmt(row.value) }));
  // 40px por barra: barra de até 24px e o resto de respiro.
  const height = Math.max(rows.length * 40, 80) + 8;

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 96, bottom: 4, left: 0 }}>
          <XAxis type="number" hide domain={[0, "dataMax"]} />
          <YAxis
            type="category"
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: GRID }}
            width={128}
            tick={CategoryTick}
          />
          <Tooltip content={BarTooltip} cursor={{ fill: "var(--muted)", opacity: 0.6 }} />
          <Bar
            dataKey="value"
            fill={SERIES}
            barSize={20}
            radius={[0, 4, 4, 0]}
            isAnimationActive={false}
          >
            <LabelList
              dataKey="formatted"
              position="right"
              style={{ fill: "var(--foreground)", fontSize: 12 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
