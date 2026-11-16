import { Button } from "@/components/ui/button";
import type { Employee, IncomeListFilters, UserRole } from "@/types/income";
import type { PaymentMethod } from "@/types/payment-method";

export const incomeKindLabels = {
  all: "Todos los ingresos",
  service: "Solo servicios",
  products: "Solo productos",
  combined: "Servicio + productos",
  subscription: "Mensualidades",
  chair_rental: "Alquiler de silla",
} as const;

const formatDate = (value: string) => {
  if (!value) return "Sin límite";
  const date = new Date(`${value}T12:00:00-03:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" }).format(date).replaceAll(".", "");
};

type Props = { value: IncomeListFilters; role: UserRole; employees: Employee[]; paymentMethods: PaymentMethod[]; onChange: (value: IncomeListFilters) => void; compact?: boolean };
export const IncomeFilterScope = ({ value, role, employees, paymentMethods, onChange, compact = false }: Props) => {
  const employee = employees.find((item) => item.id === value.employeeId);
  const method = paymentMethods.find((item) => item.id === value.paymentMethodId);
  const excludesRentals = role !== "employee" && value.kind !== "all" && value.kind !== "chair_rental";
  const hasPaymentFilter = value.paymentMethodId !== "all";
  const employeeLabel = role === "employee" ? "Tus ventas" : value.employeeId ? employee ? `${employee.firstName} ${employee.lastName}` : "Empleado seleccionado" : "Todos los empleados";
  const methodLabel = hasPaymentFilter ? method?.name ?? "Medio seleccionado" : "Todos los medios";
  if (compact) {
    return (
      <section aria-label="Qué incluyen estos importes" className="space-y-2 rounded-2xl border border-border bg-card px-3 py-3">
        <p className="text-xs font-semibold text-foreground">Qué incluyen estos importes</p>
        <div className="flex flex-wrap gap-1.5 text-[11px] leading-4">
          {[`${formatDate(value.dateFrom)} al ${formatDate(value.dateTo)}`, employeeLabel, incomeKindLabels[value.kind], methodLabel, ...(value.query ? [`Búsqueda: ${value.query}`] : []), ...(value.status === "voided" ? ["Solo anulados"] : []), ...(value.status === "active" ? ["Solo activos"] : [])].map((label, index) => (
            <span key={`${index}-${label}`} className="max-w-full break-words rounded-full border border-accent bg-accent px-2.5 py-1 text-accent-foreground">{label}</span>
          ))}
        </div>
        {excludesRentals && <p className="text-xs text-warning-foreground">Este filtro no incluye alquileres de silla. <Button type="button" variant="link" size="sm" className="h-auto min-h-8 p-0 text-xs" onClick={() => onChange({ ...value, kind: "all" })}>Ver todos</Button></p>}
        {hasPaymentFilter && <p className="text-xs leading-5 text-muted-foreground">Incluye operaciones que usaron {methodLabel}; los pagos combinados se consideran completos.</p>}
      </section>
    );
  }
  return (
    <section aria-label="Qué incluyen estos importes" className="rounded-2xl border border-border bg-card px-4 py-3">
      <p className="text-xs font-semibold text-foreground">Qué incluyen estos importes</p>
      <p className="mt-1 break-words text-sm leading-6">
        {formatDate(value.dateFrom)} al {formatDate(value.dateTo)} · {employeeLabel} · {incomeKindLabels[value.kind]} · {methodLabel}
        {value.query && <> · Búsqueda: {value.query}</>}
        {value.status === "voided" && <> · Solo anulados (no se suman)</>}
        {value.status === "active" && <> · Solo activos</>}
      </p>
      {excludesRentals && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-warning-foreground">
          <p>Este filtro no incluye alquileres de silla.</p>
          <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => onChange({ ...value, kind: "all" })}>Ver todos los conceptos</Button>
        </div>
      )}
      {hasPaymentFilter && <p className="mt-2 text-xs leading-5 text-muted-foreground">Incluye operaciones que usaron {method?.name ?? "el medio seleccionado"}. {role === "employee" ? "Tu comisión muestra lo generado por esas operaciones, también si combinaron pagos." : "Los importes muestran el total de esas operaciones, también si combinaron pagos."}</p>}
      <p className="mt-2 text-xs leading-5 text-muted-foreground">Los anulados no se suman al resumen. La búsqueda y todos los filtros de arriba se aplican a estos importes.</p>
    </section>
  );
};
