import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBuenosAiresDate, formatChairRentalPeriod } from "@/lib/chair-rentals/presentation";
import { describeComposition } from "@/lib/reports/insights";
import type { ChairRentalSummary, ExpenseBreakdownKey, IncomeBreakdownKey, ReportNamedBreakdown } from "@/types/report";

const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const paymentCountLabel = (count: number, suffix = "") => `${count} ${count === 1 ? "pago" : "pagos"}${suffix}`;
const effectivePaymentCountLabel = (count: number) => count === 1 ? "1 pago efectivo" : `${count} pagos efectivos`;
const labels: Record<IncomeBreakdownKey | ExpenseBreakdownKey, string> = {
  services: "Servicios", products: "Productos", subscriptions: "Mensualidades", chair_rentals: "Alquileres de silla",
  fixed: "Fijos", variable: "Variables", supplies: "Insumos",
};

function Bars({ entries }: { entries: Array<{ id: string; name: string; amount: number }> }) {
  const max = Math.max(...entries.map((entry) => entry.amount), 0);
  return <div className="space-y-3">{entries.map((entry) => <div key={entry.id}>
    <div className="mb-1 flex justify-between gap-3 text-sm"><span>{entry.name}</span><span className="font-medium">{money.format(entry.amount)}</span></div>
    <div role="meter" aria-label={entry.name} aria-valuemin={0} aria-valuemax={max} aria-valuenow={entry.amount} className="h-2 overflow-hidden rounded-full bg-primary/10"><div className="h-full rounded-full bg-primary" style={{ width: `${max ? Math.round(entry.amount / max * 100) : 0}%` }} /></div>
  </div>)}</div>;
}

export function ReportComposition({ income, payments, expenses, chairRentals }: {
  income: Array<{ key: IncomeBreakdownKey; amount: number }>;
  payments: ReportNamedBreakdown[];
  expenses: Array<{ key: ExpenseBreakdownKey; amount: number }>;
  chairRentals?: ChairRentalSummary;
}) {
  const groups = [
    { title: "Origen de ingresos", entries: income.map((entry) => ({ id: entry.key, name: labels[entry.key], amount: entry.amount })), insight: describeComposition(income, "income") },
    { title: "Medios de pago", entries: payments, insight: payments.length ? "Así se distribuyeron los cobros del período." : "Todavía no hay cobros en este período." },
    { title: "Estructura de gastos", entries: expenses.map((entry) => ({ id: entry.key, name: labels[entry.key], amount: entry.amount })), insight: describeComposition(expenses, "expense") },
  ];
  const effectiveDates = chairRentals?.byEffectiveDate ?? [];
  return <section className="grid gap-4 lg:grid-cols-3">
    {groups.map((group) => <Card key={group.title} className="bg-white"><CardHeader><CardTitle className="text-base">{group.title}</CardTitle></CardHeader><CardContent><Bars entries={group.entries} /><p className="mt-4 text-xs leading-5 text-muted-foreground">{group.insight}</p></CardContent></Card>)}
    {chairRentals && <Card className="bg-white lg:col-span-3">
      <CardHeader><CardTitle className="text-base">Alquileres de silla</CardTitle><p className="text-sm text-muted-foreground">Cobros por fecha de cobro y obligaciones por período facturado.</p></CardHeader>
      <CardContent className="grid gap-5 lg:grid-cols-4">
        <div><p className="text-xs text-muted-foreground">Cobrado en el período</p><p className="mt-1 text-xl font-semibold">{money.format(chairRentals.total)}</p><p className="text-xs text-muted-foreground">{effectivePaymentCountLabel(chairRentals.count)}</p></div>
        <div><p className="text-xs text-muted-foreground">Cobros por fecha de cobro</p>{effectiveDates.length ? <ul className="mt-2 space-y-1 text-sm">{effectiveDates.map((entry) => <li key={entry.date} className="flex justify-between gap-2"><span>{formatBuenosAiresDate(entry.date)} · {paymentCountLabel(entry.count)}</span><span className="font-medium">{money.format(entry.amount)}</span></li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">Sin pagos efectivos.</p>}</div>
        <div><p className="text-xs text-muted-foreground">Empleados pagadores</p><ul className="mt-2 space-y-1 text-sm">{chairRentals.payingEmployees.length ? chairRentals.payingEmployees.map((payer) => <li key={payer.employeeId} className="flex justify-between gap-2"><span>{payer.employeeName}</span><span className="font-medium">{money.format(payer.amount)}</span></li>) : <li className="text-muted-foreground">Sin pagos efectivos.</li>}</ul></div>
        <div><p className="text-xs text-muted-foreground">Obligaciones por período facturado</p><p className="mt-1 text-xl font-semibold">{chairRentals.pending.length + chairRentals.overdue.length}</p><p className="text-xs text-muted-foreground">{chairRentals.pending.length} pendientes · {chairRentals.overdue.length} vencidas</p>{[...chairRentals.pending, ...chairRentals.overdue].map((obligation) => <p key={`${obligation.employeeId}-${obligation.period}`} className="mt-1 flex justify-between gap-2 text-sm"><span>{obligation.employeeName} · {formatChairRentalPeriod(obligation.period)}</span><span className="font-medium">{money.format(obligation.amount)}</span></p>)}</div>
      </CardContent>
    </Card>}
  </section>;
}
