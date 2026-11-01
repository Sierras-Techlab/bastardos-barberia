import { formatArs } from "@/lib/incomes/income-calculations";
import type { IncomeCompositionAmounts } from "@/types/income";

export const IncomeTotals = ({ grossTotal, commissionTotal, barbershopNet }: IncomeCompositionAmounts) => (
  <div>
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {[
        { label: "Total cobrado", amount: grossTotal, hint: "Todos los medios de pago", className: "col-span-2 bg-[#202023] text-white sm:col-span-1" },
        { label: "Comisiones generadas", amount: commissionTotal, hint: "Parte que corresponde al equipo", className: "bg-[#f6f5f2]" },
        { label: "Para la barbería", amount: barbershopNet, hint: "Después de comisiones · antes de gastos", className: "bg-primary/5" },
      ].map((item) => (
        <div key={item.label} className={`min-w-0 rounded-2xl p-4 sm:p-5 ${item.className}`}>
          <dt className="text-xs font-medium opacity-75">{item.label}</dt>
          <dd className="mt-3 break-words text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">{formatArs(item.amount)}</dd>
          <p className="mt-1 text-xs leading-5 opacity-65">{item.hint}</p>
        </div>
      ))}
    </dl>
    <p className="mt-3 text-xs leading-5 text-muted-foreground">Total cobrado − comisiones = para la barbería. Que las comisiones estén generadas no significa que ya se hayan pagado.</p>
  </div>
);

