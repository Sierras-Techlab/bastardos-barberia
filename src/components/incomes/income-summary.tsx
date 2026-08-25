import { CircleDollarSign, UserRound } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  calculateIncomeTotal,
  formatArs,
} from "@/lib/incomes/income-calculations";
import type { IncomeFormValues, ManagerIncomeFormValues } from "@/lib/incomes/income-schema";
import type { IncomeFormData } from "@/types/income";

type IncomeSummaryProps = {
  values: IncomeFormValues;
  data: IncomeFormData;
};

const getServicePrice = (service: IncomeFormData["services"][number]): number =>
  "price" in service && typeof service.price === "number"
    ? service.price
    : "earning" in service ? service.earning : 0;

const getProductPrice = (product: IncomeFormData["products"][number]): number =>
  "price" in product && typeof product.price === "number"
    ? product.price
    : "earning" in product ? product.earning : 0;

export const IncomeSummary = ({ values, data }: IncomeSummaryProps) => {
  const employees = data.viewer === "manager" ? data.employees : undefined;
  const employee = employees?.find((candidate) => candidate.id === values.employeeId) ?? data.currentUser;
  const customer = data.customers.find(
    (candidate) => candidate.id === values.customerId,
  );
  const service = data.services.find(
    (candidate) => candidate.id === values.serviceId,
  );
  const totalInputs = data.viewer === "manager"
    ? { services: data.services, products: data.products }
    : {
        services: data.services.map((entry) => ({ id: entry.id, name: entry.name, price: "earning" in entry ? entry.earning : 0 })),
        products: data.products.map((entry) => ({ id: entry.id, name: entry.name, price: "earning" in entry ? entry.earning : 0, stock: entry.stock })),
      };
  const total = calculateIncomeTotal(values, totalInputs.services, totalInputs.products);
  const paymentLabel = values.payments.length > 1
    ? `Combinado (${values.payments.length} medios)`
    : data.paymentMethods.find((method) => method.id === values.payments[0]?.paymentMethodId)?.name ?? "Sin seleccionar";
  const showTotals = data.viewer === "manager";
  const managerValues = data.viewer === "manager"
    ? values as ManagerIncomeFormValues
    : null;
  const servicePrice = service && "price" in service
    ? (managerValues?.servicePriceOverride?.chargedUnitPrice ?? getServicePrice(service))
    : service ? getServicePrice(service) : 0;

  return (
    <Card
      role="region"
      aria-label="Resumen del ingreso"
      className="gap-0 rounded-[1.6rem] border-0 bg-[#202023] py-0 text-white shadow-[0_24px_60px_-35px_rgba(0,0,0,0.65)] ring-0"
    >
      <CardHeader className="border-b border-white/10 px-5 py-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Resumen
            </p>
            <CardTitle className="mt-1 text-lg text-white">
              Detalle del ingreso
            </CardTitle>
          </div>
          <span className="flex size-10 items-center justify-center rounded-full bg-white/10 text-primary">
            <CircleDollarSign className="size-5" />
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 px-5 py-5">
        <div className="flex items-start gap-3 rounded-2xl bg-white/5 p-3">
          <UserRound className="mt-0.5 size-4 text-primary" />
          <div className="min-w-0 text-sm">
            <p className="font-medium">
              {employee
                ? `${employee.firstName} ${employee.lastName}`
                : "Empleado sin seleccionar"}
            </p>
            <p className="mt-1 text-xs text-white/50">
              {customer
                ? `${customer.firstName} ${customer.lastName}`
                : "Sin cliente asociado"}
            </p>
          </div>
        </div>

        <div className="space-y-3 text-sm">
          {service && (
            <div className="flex items-start justify-between gap-4">
              <span className="text-white/70">{service.name}</span>
              <span className="shrink-0 font-medium">
                {formatArs(servicePrice)}
              </span>
            </div>
          )}

          {values.products.map((item) => {
            const product = data.products.find(
              (candidate) => candidate.id === item.productId,
            );

            if (!product) {
              return null;
            }
            const productOverride = managerValues?.productPriceOverrides.find(
              (candidate) => candidate.productId === item.productId,
            )?.override;
            const unitPrice = productOverride?.chargedUnitPrice ?? getProductPrice(product);

            return (
              <div
                key={item.productId}
                className="flex items-start justify-between gap-4"
              >
                <span className="text-white/70">
                  {product.name} × {item.quantity}
                </span>
                <span className="shrink-0 font-medium">
                  {formatArs(unitPrice * item.quantity)}
                </span>
              </div>
            );
          })}

          {!service && values.products.length === 0 && (
            <p className="rounded-xl border border-dashed border-white/15 px-3 py-5 text-center text-xs text-white/40">
              Agregá un servicio o producto para comenzar.
            </p>
          )}
        </div>

        <div className="border-t border-white/10 pt-4">
          <div className="mb-4 flex items-center justify-between gap-4 text-xs text-white/55">
            <span>Medio de pago</span>
            <span className="font-medium text-white">
              {paymentLabel}
            </span>
          </div>
          {showTotals && (
            <div className="flex items-end justify-between gap-4">
              <span className="text-sm text-white/55">Total</span>
              <span className="text-3xl font-semibold tracking-tight">
                {formatArs(total)}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
