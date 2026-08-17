import { ArrowUpRight, Banknote, CircleDollarSign, ReceiptText, WalletCards } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import type { DashboardIncomeSummary } from "@/lib/dashboard/income-summary";
import { cn } from "@/lib/utils";

type Props = { summary: DashboardIncomeSummary; isEmployee: boolean };

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const accessibleDateFormatter = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

const accessibleDayLabel = (date: string, count: number, total: number) => {
  const readableDate = accessibleDateFormatter.format(new Date(`${date}T12:00:00.000Z`)).replace(",", "");
  return `${readableDate}: ${count} ${count === 1 ? "ingreso" : "ingresos"}, ${currencyFormatter.format(total)}`;
};

export const IncomeSummaryCard = ({ summary, isEmployee }: Props) => {
  const maxTotal = Math.max(...summary.series.map(({ total }) => total), 1);

  return <section aria-labelledby="income-summary-title" className="rounded-3xl border border-black/5 bg-white p-4 shadow-[0_20px_55px_-42px_rgba(0,0,0,0.4)] sm:p-5 lg:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">Resumen diario</p>
        <h2 id="income-summary-title" className="mt-1 text-xl font-semibold">{isEmployee ? "Tus ingresos de hoy" : "Ingresos de hoy"}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{isEmployee ? "Tu actividad registrada durante el día" : "La actividad registrada por el equipo"}</p>
      </div>
      <Link href="/incomes" className={cn(buttonVariants({ variant: "outline" }), "rounded-xl bg-white")}>Ver ingresos <ArrowUpRight /></Link>
    </div>

    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <article className="rounded-2xl border border-white/10 bg-[#202023] p-4 text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
        <CircleDollarSign className="size-4 text-red-400" />
        <p className="mt-5 text-2xl font-semibold">{currencyFormatter.format(summary.today.total)}</p>
        <p className="mt-1 text-xs text-white/55">Total del día</p>
      </article>
      <article className="rounded-2xl border border-white/10 bg-primary p-4 text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
        <ReceiptText className="size-4 text-white/80" />
        <p className="mt-5 text-2xl font-semibold">{summary.today.count} {summary.today.count === 1 ? "venta" : "ventas"}</p>
        <p className="mt-1 text-xs text-white">Ingresos registrados</p>
      </article>
      <article className="rounded-2xl border border-black/5 bg-[#f7f6f3] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
        <Banknote className="size-4 text-primary" />
        <p className="mt-5 text-xl font-semibold">{currencyFormatter.format(summary.today.average)}</p>
        <p className="mt-1 text-xs text-muted-foreground">Promedio por venta</p>
      </article>
      <article className="rounded-2xl border border-black/5 bg-[#f7f6f3] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
        <WalletCards className="size-4 text-primary" />
        <div className="mt-4 space-y-1.5">
          {summary.today.paymentTotals.length > 0
            ? summary.today.paymentTotals.map((payment) => <p key={payment.paymentMethodId} className="text-sm font-semibold">{payment.name} {currencyFormatter.format(payment.amount)}</p>)
            : <p className="text-sm text-muted-foreground">Sin pagos registrados</p>}
        </div>
      </article>
    </div>

    <div className="mt-5">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div><h3 className="text-sm font-semibold">Últimos 7 días</h3><p className="text-xs text-muted-foreground">Facturación diaria registrada</p></div>
        <span className="text-xs text-muted-foreground">{summary.series.reduce((total, day) => total + day.count, 0)} ingresos</span>
      </div>
      <div className="flex h-48 items-end gap-2 rounded-2xl border border-black/5 bg-[#f7f6f3] px-3 pt-5 pb-3 sm:gap-3 sm:px-5">
        {summary.series.map((day) => <div key={day.date} role="img" aria-label={accessibleDayLabel(day.date, day.count, day.total)} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
          <div className="relative flex h-full w-full items-end justify-center">
            <span className="pointer-events-none absolute top-0 left-1/2 z-10 w-max -translate-x-1/2 rounded-lg bg-[#202023] px-2 py-1 text-[10px] text-white opacity-0 shadow-lg transition-all group-hover:opacity-100">{day.count} {day.count === 1 ? "ingreso" : "ingresos"} · {currencyFormatter.format(day.total)}</span>
            <span className="w-full max-w-10 rounded-t-xl bg-primary transition-all duration-200 group-hover:bg-[#d91f24]" style={{ height: `${day.total === 0 ? 4 : Math.max((day.total / maxTotal) * 100, 8)}%` }} />
          </div>
          <span className="text-[10px] text-muted-foreground capitalize">{day.label}</span>
        </div>)}
      </div>
    </div>
  </section>;
};
