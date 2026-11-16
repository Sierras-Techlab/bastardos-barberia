import { buildIncomeMetricCards } from "@/lib/incomes/income-metric-cards";
import type { EmployeeIncomeListMetrics, IncomeListMetrics, UserRole } from "@/types/income";
import { IncomeComposition } from "./income-composition";
import { IncomeTotals } from "./income-totals";

type Props = { metrics: IncomeListMetrics | EmployeeIncomeListMetrics; role?: UserRole };

export const IncomeMetrics = ({ metrics, role = "owner" }: Props) => {
  if (role === "employee" || "employeeCommissionTotal" in metrics) {
    return (
      <section aria-label="Resumen de ingresos" className="order-1 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {buildIncomeMetricCards(metrics, "employee").map((card, index) => (
          <div key={card.label} className={`min-w-0 rounded-2xl border p-4 sm:p-5 ${[
            "col-span-2 border-primary/20 bg-primary/10 sm:col-span-1 dark:border-accent dark:bg-accent",
            "border-info bg-info dark:border-info dark:bg-info",
            "border-success bg-success dark:border-success dark:bg-success",
          ][index] ?? "border-border bg-card"}`}>
            <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
            <p className="mt-2 break-words text-xl font-semibold tabular-nums sm:text-2xl">{card.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{card.detail}</p>
          </div>
        ))}
      </section>
    );
  }
  const manager = metrics as IncomeListMetrics;
  return (
    <>
      <section aria-label="Resumen de ingresos" className="order-1 space-y-4 rounded-3xl bg-card p-4 shadow-sm sm:p-5">
        <IncomeTotals {...manager} />
        <p className="text-xs leading-5 text-muted-foreground"><span className="font-semibold text-foreground">Ventas</span>: <span>{manager.count}</span> · Los alquileres no cuentan como ventas.</p>
      </section>
      {manager.composition
        ? <IncomeComposition composition={manager.composition} className="order-2 md:order-4">
            <p>Total cobrado − comisiones = para la barbería. Que las comisiones estén generadas no significa que ya se hayan pagado.</p>
            <p>Las comisiones se suman tal como se registraron en cada operación. Servicios y productos pueden tener porcentajes distintos; podés verlos en el detalle.</p>
          </IncomeComposition>
        : <p className="order-2 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground md:order-4">El desglose por concepto todavía no está disponible</p>}
    </>
  );
};
