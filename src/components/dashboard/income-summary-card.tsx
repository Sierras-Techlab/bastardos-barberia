import { ArrowUpRight, Banknote, CircleDollarSign, ReceiptText, WalletCards } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import type { DashboardIncomeSummary, EmployeeDashboardIncomeSummary } from "@/lib/dashboard/income-summary";
import { cn } from "@/lib/utils";

type Props = { summary: DashboardIncomeSummary | EmployeeDashboardIncomeSummary };

const currencyFormatter = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const accessibleDateFormatter = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const accessibleDayLabel = (date: string, count: number, total: number, isEmployee: boolean) => {
  const readableDate = accessibleDateFormatter.format(new Date(`${date}T12:00:00.000Z`)).replace(",", "");
  const countLabel = isEmployee ? `${count} ${count === 1 ? "ingreso" : "ingresos"}` : `${count} ${count === 1 ? "venta" : "ventas"}`;
  return `${readableDate}: ${countLabel}, ${currencyFormatter.format(total)}`;
};
const dayCountLabel = (count: number, isEmployee: boolean) => isEmployee
  ? `${count} ${count === 1 ? "ingreso" : "ingresos"}`
  : `${count} ${count === 1 ? "venta" : "ventas"}`;
const isEmployeeSummary = (summary: DashboardIncomeSummary | EmployeeDashboardIncomeSummary): summary is EmployeeDashboardIncomeSummary => "viewer" in summary && summary.viewer === "employee";

export const IncomeSummaryCard = ({ summary }: Props) => {
  const isEmployee = isEmployeeSummary(summary);
  const todayAmount = isEmployee ? summary.today.employeeCommission : summary.today.total;
  const todayLabel = isEmployee ? "Comisión generada para vos" : "Total del día";
  const todayCountLabel = isEmployee ? "Ingresos a tu nombre" : "Ventas registradas";
  const headingLabel = isEmployee ? "Tus ingresos de hoy" : "Ingresos de hoy";
  const descriptionLabel = isEmployee ? "Tu actividad registrada durante el día" : "La actividad registrada por el equipo";
  const seriesLabel = isEmployee ? "Comisión diaria registrada" : "Facturación diaria registrada";
  const maxTotal = Math.max(...summary.series.map(({ total }) => total), 1);
  const managerToday = !isEmployee ? summary.today : null;

  return <section aria-labelledby="income-summary-title" className="rounded-3xl border border-border bg-card p-4 shadow-[0_20px_55px_-42px_rgba(0,0,0,0.4)] sm:p-5 lg:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-semibold tracking-[0.16em] text-brand-foreground uppercase">Resumen diario</p><h2 id="income-summary-title" className="mt-1 text-xl font-semibold">{headingLabel}</h2><p className="mt-1 text-sm text-muted-foreground">{descriptionLabel}</p></div>
      <Link href="/incomes" className={cn(buttonVariants({ variant: "outline" }), "min-h-11 rounded-xl")}>Ver ingresos <ArrowUpRight /></Link>
    </div>

    <div className={`mt-5 grid min-w-0 grid-cols-2 gap-2.5 sm:gap-3 ${isEmployee ? "xl:grid-cols-2" : "xl:grid-cols-4"}`}>
      <article className="min-w-0 rounded-2xl border border-white/10 bg-[#202023] p-3 text-white sm:p-4">
        <CircleDollarSign className="size-4 text-red-400" /><p className="mt-5 text-2xl font-semibold">{currencyFormatter.format(todayAmount)}</p><p className="mt-1 text-xs text-white/70">{todayLabel}</p>
      </article>
      <article className="min-w-0 rounded-2xl border border-white/10 bg-primary p-3 text-primary-foreground sm:p-4">
        <ReceiptText className="size-4" /><p className="mt-5 text-xl font-semibold sm:text-2xl">{dayCountLabel(summary.today.count, isEmployee)}</p><p className="mt-1 text-xs">{todayCountLabel}</p>
      </article>
      {managerToday && <>
        <article className="min-w-0 rounded-2xl border border-border bg-muted p-3 sm:p-4"><Banknote className="size-4 text-brand-foreground" /><p className="mt-4 text-lg font-semibold sm:mt-5 sm:text-xl">{currencyFormatter.format(managerToday.average)}</p><p className="mt-1 text-xs text-muted-foreground">Promedio por venta</p></article>
        <article className="col-span-2 min-w-0 rounded-2xl border border-border bg-muted p-3 sm:p-4 xl:col-span-1"><WalletCards className="size-4 text-brand-foreground" /><div className="mt-3 grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-2 xl:grid-cols-1">{managerToday.paymentTotals.length > 0 ? managerToday.paymentTotals.map((payment) => <p key={payment.paymentMethodId} className="min-w-0 break-words text-sm font-semibold">{payment.name} <span className="whitespace-nowrap">{currencyFormatter.format(payment.amount)}</span></p>) : <p className="text-sm text-muted-foreground">Sin pagos registrados</p>}</div></article>
      </>}
    </div>

    <div className="mt-5">
      <div className="mb-3 flex items-end justify-between gap-3"><div><h3 className="text-sm font-semibold">Últimos 7 días</h3><p className="text-xs text-muted-foreground">{seriesLabel}</p></div><span className="text-xs text-muted-foreground">{summary.series.reduce((total, day) => total + day.count, 0)} {isEmployee ? "ingresos" : "ventas"}</span></div>
      <div role="group" aria-label={`Gráfico de ${seriesLabel.toLowerCase()} de los últimos siete días`} className="flex h-48 items-end gap-2 rounded-2xl border border-border bg-muted px-3 pt-5 pb-3 sm:gap-3 sm:px-5">
        {summary.series.map((day) => <div key={day.date} role="img" aria-label={accessibleDayLabel(day.date, day.count, day.total, isEmployee)} className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2 rounded-lg px-1">
          <span className="pointer-events-none absolute top-0 left-1/2 z-10 w-max max-w-[min(14rem,80vw)] -translate-x-1/2 rounded-lg bg-popover px-2 py-1 text-center text-[10px] text-popover-foreground opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">{dayCountLabel(day.count, isEmployee)} · {currencyFormatter.format(day.total)}</span>
          <span className="flex h-full w-full items-end justify-center"><span aria-hidden="true" className="w-full max-w-10 rounded-t-xl bg-primary transition-colors group-hover:bg-primary/80" style={{ height: `${day.total === 0 ? 4 : Math.max((day.total / maxTotal) * 100, 8)}%` }} /></span>
          <span aria-hidden="true" className="text-[10px] text-muted-foreground capitalize">{day.label}</span>
        </div>)}
      </div>
      <details className="mt-3 rounded-xl border border-border bg-card px-3 py-2 text-sm">
        <summary className="min-h-11 cursor-pointer py-3 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Consultar importes por día</summary>
        <ul className="space-y-2 pb-2">
          {summary.series.map((day) => <li key={day.date} className="flex flex-wrap justify-between gap-2 border-t border-border pt-2"><span className="capitalize">{accessibleDateFormatter.format(new Date(`${day.date}T12:00:00.000Z`)).replace(",", "")}</span><span className="font-medium">{dayCountLabel(day.count, isEmployee)} · {currencyFormatter.format(day.total)}</span></li>)}
        </ul>
      </details>
    </div>
  </section>;
};
