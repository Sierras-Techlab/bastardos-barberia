import { formatArs } from "@/lib/incomes/income-calculations";
import type { IncomeListMetrics, UserRole } from "@/types/income";

export type IncomeMetricCard = { label: string; value: string; detail: string; tone: "dark" | "primary" | "light" | "muted" };
const unavailable = "Pendiente de backend";
const grossTotal = (metrics: IncomeListMetrics) => metrics.grossTotal ?? metrics.total ?? 0;
export const buildIncomeMetricCards = (metrics: IncomeListMetrics, role: UserRole): IncomeMetricCard[] => role === "employee" ? [
  { label: "Total vendido", value: formatArs(grossTotal(metrics)), detail: "Mis ingresos activos", tone: "dark" },
  { label: "Mi comisión", value: metrics.commissionTotal === undefined ? unavailable : formatArs(metrics.commissionTotal), detail: metrics.commissionTotal === undefined ? "Disponible al integrar V2" : "Comisión devengada", tone: "primary" },
  { label: "Ventas", value: String(metrics.count), detail: "Movimientos registrados", tone: "light" },
  { label: "Promedio por venta", value: formatArs(metrics.average), detail: "Sobre mis ventas activas", tone: "muted" },
] : [
  { label: "Facturación bruta", value: formatArs(grossTotal(metrics)), detail: "Ingresos activos", tone: "dark" },
  { label: "Comisiones", value: metrics.commissionTotal === undefined ? unavailable : formatArs(metrics.commissionTotal), detail: metrics.commissionTotal === undefined ? "Disponible al integrar V2" : "Comisiones devengadas", tone: "primary" },
  { label: "Neto barbería", value: metrics.barbershopNet === undefined ? unavailable : formatArs(metrics.barbershopNet), detail: metrics.barbershopNet === undefined ? "Disponible al integrar V2" : "Facturado menos comisiones", tone: "light" },
  { label: "Ventas", value: String(metrics.count), detail: "Movimientos registrados", tone: "muted" },
];
