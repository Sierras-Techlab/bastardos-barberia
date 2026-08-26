import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { describeComposition } from "@/lib/reports/insights";
import type { ExpenseBreakdownKey, IncomeBreakdownKey, ReportNamedBreakdown } from "@/types/report";

const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const labels: Record<IncomeBreakdownKey | ExpenseBreakdownKey, string> = { services: "Servicios", products: "Productos", subscriptions: "Mensualidades", fixed: "Fijos", variable: "Variables", supplies: "Insumos" };
function Bars({ entries }: { entries: Array<{ id: string; name: string; amount: number }> }) { const max = Math.max(...entries.map((e) => e.amount), 0); return <div className="space-y-3">{entries.map((entry) => <div key={entry.id}><div className="mb-1 flex justify-between gap-3 text-sm"><span>{entry.name}</span><span className="font-medium">{money.format(entry.amount)}</span></div><div role="meter" aria-label={entry.name} aria-valuemin={0} aria-valuemax={max} aria-valuenow={entry.amount} className="h-2 overflow-hidden rounded-full bg-primary/10"><div className="h-full rounded-full bg-primary" style={{ width: `${max ? Math.round(entry.amount / max * 100) : 0}%` }} /></div></div>)}</div>; }
export function ReportComposition({ income, payments, expenses }: { income: Array<{ key: IncomeBreakdownKey; amount: number }>; payments: ReportNamedBreakdown[]; expenses: Array<{ key: ExpenseBreakdownKey; amount: number }> }) {
  const groups = [
    { title: "Origen de ingresos", entries: income.map((e) => ({ id: e.key, name: labels[e.key], amount: e.amount })), insight: describeComposition(income, "income") },
    { title: "Medios de pago", entries: payments, insight: payments.length ? "Así se distribuyeron los cobros del período." : "Todavía no hay cobros en este período." },
    { title: "Estructura de gastos", entries: expenses.map((e) => ({ id: e.key, name: labels[e.key], amount: e.amount })), insight: describeComposition(expenses, "expense") },
  ];
  return <section className="grid gap-4 lg:grid-cols-3">{groups.map((group) => <Card key={group.title} className="bg-white"><CardHeader><CardTitle className="text-base">{group.title}</CardTitle></CardHeader><CardContent><Bars entries={group.entries} /><p className="mt-4 text-xs leading-5 text-muted-foreground">{group.insight}</p></CardContent></Card>)}</section>;
}
