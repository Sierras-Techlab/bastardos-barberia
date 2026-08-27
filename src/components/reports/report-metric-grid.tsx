import { Card, CardContent } from "@/components/ui/card";
import { compareMetric, type MetricDirection } from "@/lib/reports/insights";
import type { ReportMetrics } from "@/types/report";

const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const definitions: Array<{ key: keyof ReportMetrics; label: string; direction: MetricDirection; format: "money" | "percent" }> = [
  { key: "grossIncome", label: "Ingresos", direction: "higher-is-better", format: "money" },
  { key: "commission", label: "Comisiones", direction: "neutral", format: "money" },
  { key: "barbershopNet", label: "Neto barbería", direction: "higher-is-better", format: "money" },
  { key: "expenses", label: "Gastos", direction: "lower-is-better", format: "money" },
  { key: "operatingResult", label: "Resultado", direction: "higher-is-better", format: "money" },
  { key: "operatingMarginBps", label: "Margen operativo", direction: "higher-is-better", format: "percent" },
];

export function ReportMetricGrid({ current, previous }: { current: ReportMetrics; previous: ReportMetrics }) {
  return <section aria-label="Resumen financiero" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{definitions.map(({ key, label, direction, format }) => {
    const value = current[key]; const old = previous[key];
    const comparison = compareMetric(value ?? 0, old ?? 0, direction);
    return <Card key={key} data-testid={`metric-${key === "commission" ? "commission" : key}`} data-tone={comparison.tone} className="bg-white"><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-xl font-semibold">{format === "percent" ? value === null ? "—" : `${(value / 100).toLocaleString("es-AR")}%` : money.format(value ?? 0)}</p><p className="mt-2 text-xs text-muted-foreground">{comparison.percent === null ? "Sin base de comparación" : `${comparison.percent > 0 ? "+" : ""}${comparison.percent}% vs. período anterior`}</p></CardContent></Card>;
  })}</section>;
}
