import { CircleDollarSign, UserRound } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  calculateIncomeTotal,
  formatArs,
} from "@/lib/incomes/income-calculations";
import type { IncomeFormValues } from "@/lib/incomes/income-schema";
import type { IncomeFormData } from "@/types/income";

type IncomeSummaryProps = {
  values: IncomeFormValues;
  data: IncomeFormData;
};

const paymentLabels = {
  cash: "Efectivo",
  transfer: "Transferencia",
};

export const IncomeSummary = ({ values, data }: IncomeSummaryProps) => {
  const employee = data.employees.find(
    (candidate) => candidate.id === values.employeeId,
  );
  const customer = data.customers.find(
    (candidate) => candidate.id === values.customerId,
  );
  const service = data.services.find(
    (candidate) => candidate.id === values.serviceId,
  );
  const total = calculateIncomeTotal(
    values,
    data.services,
    data.products,
  );

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
                {formatArs(service.price)}
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

            return (
              <div
                key={item.productId}
                className="flex items-start justify-between gap-4"
              >
                <span className="text-white/70">
                  {product.name} × {item.quantity}
                </span>
                <span className="shrink-0 font-medium">
                  {formatArs(product.price * item.quantity)}
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
              {values.paymentMethod
                ? paymentLabels[values.paymentMethod]
                : "Sin seleccionar"}
            </span>
          </div>
          <div className="flex items-end justify-between gap-4">
            <span className="text-sm text-white/55">Total</span>
            <span className="text-3xl font-semibold tracking-tight">
              {formatArs(total)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
