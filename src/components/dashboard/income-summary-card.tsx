import { CreditCard, Scissors } from "lucide-react";

import { QuickActionsCard } from "@/components/dashboard/quick-actions-card";
import type { DashboardIncomeSummary, EmployeeDashboardIncomeSummary } from "@/lib/dashboard/income-summary";
import { cn } from "@/lib/utils";

type Props = {
  summary: DashboardIncomeSummary | EmployeeDashboardIncomeSummary;
  canCreateIncome?: boolean;
};

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const compositionNote = "Incluye mensualidades; excluye alquileres de silla.";
const collectionNote = "Pueden incluir mensualidades de clientes fijos y alquileres de silla.";

function AmountUnderline() {
  return (
    <svg viewBox="0 0 220 16" fill="none" aria-hidden="true" className="mt-1.5 h-3 w-36 text-[#dc2626] lg:w-44">
      <path d="M4 10.5C48 4.2 118 3.5 214 8.5C168 11.2 92 12.8 18 13.5" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="208" cy="13" r="2" fill="currentColor" />
      <circle cx="14" cy="5" r="1.5" fill="currentColor" opacity=".65" />
    </svg>
  );
}

function ManagerBreakdown({ today }: { today: DashboardIncomeSummary["today"] }) {
  const payments = today.paymentTotals.filter((payment) => payment.amount > 0);
  const metrics = [
    { label: "Cantidad de ingresos", value: today.count },
    { label: "Promedio por ingreso", value: currency.format(today.average) },
  ];

  return (
    <div className="grid min-w-0 gap-3 pt-1 lg:mt-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start lg:gap-6 lg:border-t lg:border-border lg:pt-6">
      <div className="min-w-0 rounded-3xl border border-border bg-card px-4 py-3 shadow-sm lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none dark:bg-[#131318] lg:dark:bg-transparent">
        <dl className="grid min-w-0 grid-cols-2 divide-x divide-border lg:gap-3 lg:divide-x-0">
        {metrics.map(({ label, value }) => (
          <div key={label} className="min-w-0 px-2 first:pl-0 lg:rounded-2xl lg:border lg:border-border lg:bg-muted lg:p-3.5 lg:first:pl-3.5 lg:dark:bg-[#191920]">
            <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-xl font-black tracking-tight tabular-nums sm:text-2xl">{value}</dd>
            <dd className="mt-2 hidden text-[11px] leading-snug text-muted-foreground lg:block">{compositionNote}</dd>
          </div>
        ))}
        </dl>
        <p className="mt-2 border-t border-border pt-2 text-[11px] leading-snug text-muted-foreground lg:hidden">{compositionNote}</p>
      </div>
      <section aria-labelledby="payment-totals-title" className="min-w-0 rounded-2xl border border-border bg-card p-3.5 shadow-sm lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none dark:bg-[#131318] lg:dark:bg-transparent">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <h3 id="payment-totals-title" className="text-xs font-bold">Totales por medio de pago</h3>
          <CreditCard aria-hidden="true" className="size-3.5 text-brand-foreground lg:hidden" />
          <p className="basis-full text-[11px] leading-snug text-muted-foreground xl:basis-auto">{collectionNote}</p>
        </div>
        {payments.length === 0 ? (
          <p className="mt-2 rounded-xl border border-border bg-muted px-3 py-2 text-xs text-muted-foreground dark:bg-[#191920]">
            Sin pagos registrados
          </p>
        ) : (
          <ul className="mt-2 grid grid-cols-2 gap-1.5 lg:flex lg:flex-wrap lg:gap-2">
            {payments.map((payment) => (
              <li key={payment.paymentMethodId} className="flex min-w-0 max-w-full flex-wrap items-center justify-between gap-x-2 gap-y-0.5 rounded-2xl border border-border bg-muted px-2.5 py-1.5 text-[11px] lg:px-3 dark:bg-[#191920]">
                <span className="min-w-0 break-words text-muted-foreground">{payment.name}</span>
                <strong className="font-bold whitespace-nowrap tabular-nums">{currency.format(payment.amount)}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function IncomeSummaryCard({ summary, canCreateIncome = true }: Props) {
  const employee = "viewer" in summary;
  const amount = employee ? summary.today.employeeCommission : summary.today.total;

  return (
    <section
      aria-labelledby="income-summary-title"
      className="min-w-0 lg:rounded-3xl lg:border lg:border-border lg:bg-card lg:p-6 lg:shadow-sm lg:dark:bg-[#131318] xl:p-7"
    >
      <div className="grid min-w-0 items-center gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-6">
        <div className={cn("min-w-0 text-center lg:text-left", employee && "lg:flex lg:flex-wrap lg:items-center lg:gap-5 xl:gap-7")}>
          <div className="min-w-0">
            <h2 id="income-summary-title" className="text-xs font-semibold text-muted-foreground">
              {employee ? "Tu comisión generada hoy" : "Total de ingresos activos de hoy"}
            </h2>
            <p className="mt-1 text-[clamp(2rem,11vw,2.625rem)] leading-none font-black tracking-[-0.055em] break-words tabular-nums lg:text-5xl">
              {currency.format(amount)}
            </p>
            <div className="flex justify-center lg:justify-start"><AmountUnderline /></div>
            {!employee && (
              <p className="mx-auto mt-2 max-w-[18rem] text-[11px] leading-snug text-muted-foreground lg:mx-0 lg:max-w-none lg:text-xs">
                Puede incluir mensualidades de clientes fijos y alquileres de silla.
              </p>
            )}
          </div>
          {employee && (
            <div className="mt-2 inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs lg:mt-0 lg:block lg:rounded-2xl lg:bg-muted lg:px-4 lg:py-3 dark:bg-[#191920]">
              <Scissors aria-hidden="true" className="size-3.5 text-brand-foreground lg:hidden" />
              <span className="font-medium text-muted-foreground">Ingresos que te corresponden</span>
              <p className="font-black tabular-nums lg:mt-1 lg:text-2xl">
                {summary.today.count} <span className="hidden text-xs font-medium text-muted-foreground lg:inline">{summary.today.count === 1 ? "ingreso hoy" : "ingresos hoy"}</span>
              </p>
            </div>
          )}
        </div>
        <QuickActionsCard canCreateIncome={canCreateIncome} />
      </div>
      {!employee && <ManagerBreakdown today={summary.today} />}
    </section>
  );
}
