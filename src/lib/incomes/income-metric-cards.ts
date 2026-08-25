import { formatArs } from "@/lib/incomes/income-calculations";
import type { EmployeeIncomeListMetrics, IncomeListMetrics, UserRole } from "@/types/income";

export type IncomeMetricCard = { label: string; value: string; detail: string; tone: "dark" | "primary" | "light" | "muted" };

const isEmployeeMetrics = (metrics: IncomeListMetrics | EmployeeIncomeListMetrics): metrics is EmployeeIncomeListMetrics =>
  typeof (metrics as EmployeeIncomeListMetrics).employeeCommissionTotal === "number";

export const buildIncomeMetricCards = (
  metrics: IncomeListMetrics | EmployeeIncomeListMetrics,
  role: UserRole,
): IncomeMetricCard[] => {
  if (role === "employee" || isEmployeeMetrics(metrics)) {
    const employee = metrics as EmployeeIncomeListMetrics;
    return [
      { label: "Tu ingreso", value: formatArs(employee.employeeCommissionTotal), detail: "Comisión registrada", tone: "dark" },
      { label: "Ventas", value: String(employee.count), detail: "Movimientos activos", tone: "primary" },
      { label: "Tu ganancia promedio", value: employee.count > 0 ? formatArs(Math.round(employee.employeeCommissionTotal / employee.count)) : formatArs(0), detail: "Por venta activa", tone: "light" },
    ];
  }
  const manager = metrics as IncomeListMetrics;
  return [
    { label: "Facturación bruta", value: formatArs(manager.grossTotal), detail: "Ingresos activos", tone: "dark" },
    { label: "Comisiones", value: formatArs(manager.commissionTotal), detail: "Comisiones devengadas", tone: "primary" },
    { label: "Neto barbería", value: formatArs(manager.barbershopNet), detail: "Facturado menos comisiones", tone: "light" },
    { label: "Ventas", value: String(manager.count), detail: "Movimientos registrados", tone: "muted" },
  ];
};
