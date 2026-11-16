import { formatArs } from "@/lib/incomes/income-calculations";
import type { IncomeCompositionAmounts } from "@/types/income";

export const IncomeTotals = ({ grossTotal, commissionTotal, barbershopNet }: IncomeCompositionAmounts) => (
  <div>
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {[
        { label: "Total cobrado", amount: grossTotal, hint: "Todos los medios de pago", className: "border-primary/20 bg-primary/10 dark:border-accent dark:bg-accent" },
        { label: "Comisiones generadas", amount: commissionTotal, hint: "Parte que corresponde al equipo", className: "border-info bg-info dark:border-info dark:bg-info" },
        { label: "Para la barbería", amount: barbershopNet, hint: "Después de comisiones · antes de gastos", className: "col-span-2 border-success bg-success sm:col-span-1 dark:border-success dark:bg-success" },
      ].map((item) => (
        <div key={item.label} className={`min-w-0 rounded-2xl border border-border p-4 sm:p-5 ${item.className}`}>
          <dt className="text-xs font-medium opacity-75">{item.label}</dt>
          <dd className="mt-3 break-words text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">{formatArs(item.amount)}</dd>
          <p className="mt-1 text-xs leading-5 opacity-65">{item.hint}</p>
        </div>
      ))}
    </dl>
    <p className="mt-3 text-xs leading-5 text-muted-foreground">Total cobrado − comisiones = para la barbería. Que las comisiones estén generadas no significa que ya se hayan pagado.</p>
  </div>
);

