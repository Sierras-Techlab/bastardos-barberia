import { buildIncomeMetricCards } from "@/lib/incomes/income-metric-cards";
import type { EmployeeIncomeListMetrics, IncomeListMetrics, UserRole } from "@/types/income";
import { IncomeComposition } from "./income-composition";
import { IncomeTotals } from "./income-totals";

type Props = { metrics: IncomeListMetrics | EmployeeIncomeListMetrics; role?: UserRole };

export const IncomeMetrics = ({ metrics, role = "owner" }: Props) => {
  if (role === "employee" || "employeeCommissionTotal" in metrics) {
    return (
      <section aria-label="Resumen de ingresos" className="grid gap-3 sm:grid-cols-3">
        {buildIncomeMetricCards(metrics, "employee").map((card, index) => (
          <div key={card.label} className={`rounded-2xl p-5 ${index === 0 ? "bg-[#202023] text-white" : "bg-card"}`}>
            <p className="text-xs font-medium opacity-70">{card.label}</p>
            <p className="mt-3 text-2xl font-semibold tabular-nums">{card.value}</p>
            <p className="mt-1 text-xs opacity-65">{card.detail}</p>
          </div>
        ))}
      </section>
    );
  }
  const manager = metrics as IncomeListMetrics;
  return (
    <section aria-label="Resumen de ingresos" className="space-y-4 rounded-3xl bg-card p-4 shadow-sm sm:p-5">
      <IncomeTotals {...manager} />
      <p className="text-xs leading-5 text-muted-foreground"><span className="font-semibold text-foreground">Ventas</span>: <span>{manager.count}</span> · Los alquileres no cuentan como ventas.</p>
      {manager.composition
        ? <IncomeComposition composition={manager.composition}>
            <p>Total cobrado − comisiones = para la barbería. Que las comisiones estén generadas no significa que ya se hayan pagado.</p>
            <p>Las comisiones se suman tal como se registraron en cada operación. Servicios y productos pueden tener porcentajes distintos; podés verlos en el detalle.</p>
          </IncomeComposition>
        : <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">El desglose por concepto todavía no está disponible</p>}
    </section>
  );
};
