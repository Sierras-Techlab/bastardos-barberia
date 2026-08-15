import { formatArs } from "@/lib/incomes/income-calculations";
import type { IncomeListMetrics, UserRole } from "@/types/income";

export type IncomeMetricCard = { label: string; value: string; detail: string; tone: "dark" | "primary" | "light" | "muted" };
export const buildIncomeMetricCards = (metrics: IncomeListMetrics, role: UserRole): IncomeMetricCard[] => role === "employee" ? [
  { label: "Total vendido", value: formatArs(metrics.grossTotal), detail: "Mis ingresos activos", tone: "dark" },
  { label: "Mi comisión", value: formatArs(metrics.commissionTotal), detail: "Comisión devengada", tone: "primary" },
  { label: "Ventas", value: String(metrics.count), detail: "Movimientos registrados", tone: "light" },
  { label: "Promedio por venta", value: formatArs(metrics.average), detail: "Sobre mis ventas activas", tone: "muted" },
] : [
  { label: "Facturación bruta", value: formatArs(metrics.grossTotal), detail: "Ingresos activos", tone: "dark" },
  { label: "Comisiones", value: formatArs(metrics.commissionTotal), detail: "Comisiones devengadas", tone: "primary" },
  { label: "Neto barbería", value: formatArs(metrics.barbershopNet), detail: "Facturado menos comisiones", tone: "light" },
  { label: "Ventas", value: String(metrics.count), detail: "Movimientos registrados", tone: "muted" },
];
