import { BadgePercent } from "lucide-react";
import { formatArs } from "@/lib/incomes/income-calculations";
import { calculateCommissionPreview } from "@/lib/incomes/income-commissions";
import type { IncomeFormValues } from "@/lib/incomes/income-schema";
import type { IncomeFormData, IncomeFormEmployee } from "@/types/income";

type Props = {
  values: IncomeFormValues;
  data: IncomeFormData;
  onGrantFullServiceCommission?: (checked: boolean) => void;
};

const fallbackEmployee: IncomeFormEmployee = {
  id: "",
  firstName: "",
  lastName: "",
  role: "employee",
  isActive: true,
  serviceCommissionRate: 0,
  productCommissionRate: 0,
};

export const CommissionPreview = ({
  values,
  data,
  onGrantFullServiceCommission,
}: Props) => {
  const employees = data.viewer === "manager" ? data.employees : undefined;
  const employee =
    employees?.find((item) => item.id === values.employeeId) ??
    (data.currentUser.id === values.employeeId
      ? {
          ...data.currentUser,
          isActive: true,
          serviceCommissionRate: 0,
          productCommissionRate: 0,
        }
      : fallbackEmployee);
  if (!employee) return null;

  if (data.viewer === "employee") {
    const service = data.services.find((item) => item.id === values.serviceId);
    const serviceEarning = service && "earning" in service ? service.earning : 0;
    const productEarnings = values.products.reduce((sum, item) => {
      const product = data.products.find((candidate) => candidate.id === item.productId);
      if (!product || !("earning" in product)) return sum;
      const isFullCommission = item.grantFullCommission;
      const lineTotal = product.earning * item.quantity;
      return sum + (isFullCommission ? lineTotal : Math.round((lineTotal * employee.productCommissionRate) / 100));
    }, 0);
    const isFullServiceCommission = values.grantFullServiceCommission;
    const serviceTotal = service
      ? (isFullServiceCommission ? serviceEarning : Math.round((serviceEarning * employee.serviceCommissionRate) / 100))
      : 0;
    const total = serviceTotal + productEarnings;
    return <section aria-label="Tu ganancia" className="rounded-[1.6rem] bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2"><BadgePercent className="size-4 text-primary"/><h3 className="font-semibold">Tu ganancia</h3></div>
      <div className="mt-4 text-sm"><p className="text-xs text-muted-foreground">Comisión estimada</p><p className="mt-1 font-semibold">{formatArs(total)}</p></div>
      <p className="mt-3 text-[11px] text-muted-foreground">El backend validará y calculará los importes definitivos.</p>
    </section>;
  }

  const service = data.services.find((item) => item.id === values.serviceId);
  const serviceBase = service && "price" in service ? service.price : 0;
  const preview = calculateCommissionPreview({
    responsibleRole: employee?.role ?? "employee",
    serviceBase,
    serviceRate: employee?.serviceCommissionRate ?? 0,
    productRate: employee?.productCommissionRate ?? 0,
    grantFullServiceCommission: values.grantFullServiceCommission,
    products: values.products.flatMap((item) => {
      const product = data.products.find((candidate) => candidate.id === item.productId);
      return product && "price" in product ? [{ ...item, price: product.price }] : [];
    }),
  });
  const manager = data.currentUser.role === "owner" || data.currentUser.role === "admin";
  const eligible = manager && employee?.role !== "owner" && Boolean(service) && employee?.id !== data.currentUser.id;
  return <section aria-label="Comisión estimada" className="rounded-[1.6rem] bg-white p-5 shadow-sm">
    <div className="flex items-center gap-2"><BadgePercent className="size-4 text-primary"/><h3 className="font-semibold">Comisión estimada</h3></div>
    <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-muted-foreground">Para {employee.firstName}</p><p className="mt-1 font-semibold">{formatArs(preview.total)}</p></div><div><p className="text-xs text-muted-foreground">Neto barbería</p><p className="mt-1 font-semibold">{formatArs(preview.barbershopNet)}</p></div></div>
    <div className="mt-3 space-y-1 text-xs text-muted-foreground">
      {service && preview.service && <p>{service.name} · {preview.service.rate}% · {formatArs(preview.service.amount)}</p>}
      {values.products.map((item, index) => { const product = data.products.find((candidate) => candidate.id === item.productId); const line = preview.products[index]; return product && line ? <p key={item.productId}>{product.name} · {line.rate}% · {formatArs(line.amount)}</p> : null;})}
    </div>
    {eligible && onGrantFullServiceCommission && <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl bg-red-50 p-3 text-sm"><input type="checkbox" checked={values.grantFullServiceCommission} onChange={(event) => onGrantFullServiceCommission(event.target.checked)} className="mt-0.5 size-4 accent-red-600" /><span>¿Regalar el 100% de este servicio a {employee.firstName}?</span></label>}
    <p className="mt-3 text-[11px] text-muted-foreground">Vista previa. El backend deberá validar y calcular los importes definitivos.</p>
  </section>;
};