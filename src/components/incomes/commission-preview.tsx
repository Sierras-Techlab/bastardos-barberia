import { BadgePercent } from "lucide-react";
import { calculateIncomeTotal, formatArs } from "@/lib/incomes/income-calculations";
import { calculateCommissionPreview } from "@/lib/incomes/income-commissions";
import type { IncomeFormValues } from "@/lib/incomes/income-schema";
import type { IncomeFormData } from "@/types/income";

type Props = { values: IncomeFormValues; data: IncomeFormData; onGrantFullServiceCommission?: (checked: boolean) => void };
export const CommissionPreview = ({ values, data, onGrantFullServiceCommission }: Props) => {
  const employee = data.employees?.find((item) => item.id === values.employeeId) ?? (data.currentUser.id === values.employeeId ? { ...data.currentUser, isActive: true, serviceCommissionRate: 0, productCommissionRate: 0 } : undefined);
  const service = data.services.find((item) => item.id === values.serviceId);
  const serviceBase = service?.price ?? 0;
  const total = calculateIncomeTotal(values, data.services, data.products);
  const preview = calculateCommissionPreview({ responsibleRole: employee?.role ?? "employee", serviceBase, productBase: total - serviceBase, serviceRate: employee?.serviceCommissionRate ?? 0, productRate: employee?.productCommissionRate ?? 0, grantFullServiceCommission: values.grantFullServiceCommission });
  const manager = data.currentUser.role === "owner" || data.currentUser.role === "admin";
  const eligible = manager && employee?.role !== "owner" && Boolean(service) && employee?.id !== data.currentUser.id;
  if (!employee) return null;
  return <section aria-label="Comisión estimada" className="rounded-[1.6rem] bg-white p-5 shadow-sm">
    <div className="flex items-center gap-2"><BadgePercent className="size-4 text-primary"/><h3 className="font-semibold">Comisión estimada</h3></div>
    <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-muted-foreground">Para {employee.firstName}</p><p className="mt-1 font-semibold">{formatArs(preview.total)}</p></div><div><p className="text-xs text-muted-foreground">Neto barbería</p><p className="mt-1 font-semibold">{formatArs(preview.barbershopNet)}</p></div></div>
    <p className="mt-3 text-xs text-muted-foreground">Servicio {preview.serviceRate}% · Productos {preview.productRate}%</p>
    {eligible && onGrantFullServiceCommission && <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl bg-red-50 p-3 text-sm"><input type="checkbox" checked={values.grantFullServiceCommission} onChange={(event) => onGrantFullServiceCommission(event.target.checked)} className="mt-0.5 size-4 accent-red-600" /><span>¿Regalar el 100% de este servicio a {employee.firstName}?</span></label>}
    <p className="mt-3 text-[11px] text-muted-foreground">Vista previa. El backend deberá validar y calcular los importes definitivos.</p>
  </section>;
};
