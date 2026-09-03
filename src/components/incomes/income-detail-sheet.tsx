"use client";

import { Package, Scissors, UserRound, WalletCards } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatArs } from "@/lib/incomes/income-calculations";
import { formatIncomeDateTime } from "@/lib/incomes/income-list";
import type { EmployeeIncomeListItem, IncomeListItem, IncomeListRow, UserRole } from "@/types/income";

type IncomeDetailSheetProps = {
  income: IncomeListRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canVoid?: boolean;
  onVoid?: (income: IncomeListRow) => void;
  viewerRole?: UserRole;
};

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-1 py-2.5">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="min-w-0 max-w-full break-words text-right font-medium">{value}</dd>
  </div>
);

const isEmployeeRow = (row: IncomeListRow): row is EmployeeIncomeListItem =>
  Array.isArray((row as EmployeeIncomeListItem).concepts);

export const IncomeDetailSheet = ({
  income,
  open,
  onOpenChange,
  canVoid = false,
  onVoid,
  viewerRole = "owner",
}: IncomeDetailSheetProps) => {
  if (!income) return null;

  const customerName = income.customer
    ? `${income.customer.firstName} ${income.customer.lastName}`
    : "Sin cliente";
  const manager = viewerRole === "owner" || viewerRole === "admin";
  const employee = isEmployeeRow(income) ? null : (income as IncomeListItem);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto border-0 sm:max-w-md">
        <SheetHeader className="border-b border-black/5 px-6 py-5 pr-14">
          <div className="flex items-center gap-2">
            <SheetTitle className="text-xl">Detalle del ingreso</SheetTitle>
            {income.status === "voided" && (
              <Badge variant="secondary" className="rounded-full">
                Anulado
              </Badge>
            )}
          </div>
          <SheetDescription>{formatIncomeDateTime(income.createdAt)}</SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-6 pb-6">
          {employee && (
            <section className="rounded-[1.35rem] bg-[#f6f5f2] p-4">
              <p className="text-xs font-medium tracking-[0.16em] text-primary uppercase">
                Total
              </p>
              <p
                className={`mt-1 text-3xl font-semibold ${
                  income.status === "voided" ? "text-muted-foreground line-through" : ""
                }`}
              >
                {formatArs(employee.total)}
              </p>
            </section>
          )}

          <section>
            <h3 className="mb-2 flex items-center gap-2 font-semibold">
              <Scissors className="size-4 text-primary" />
              Concepto
            </h3>
            <div className="divide-y divide-black/5 rounded-[1.25rem] border border-black/5 px-4">
              {employee?.service && (
                <DetailRow
                  label={employee.service.name}
                  value={formatArs(employee.service.price)}
                />
              )}
              {employee?.sourceType === "fixed_subscription" && employee.subscription && (
                <DetailRow
                  label={`Mensualidad ${employee.subscription.label}`}
                  value={formatArs(employee.subscription.monthlyPrice)}
                />
              )}
              {employee?.products.map((product) => (
                <DetailRow
                  key={product.id}
                  label={`${product.quantity} × ${product.name}`}
                  value={formatArs(product.unitPrice * product.quantity)}
                />
              ))}
              {isEmployeeRow(income) && income.concepts.map((concept) => (
                <DetailRow
                  key={concept.id}
                  label={`${concept.quantity} × ${concept.name}`}
                  value={formatArs(concept.earning)}
                />
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-2 flex items-center gap-2 font-semibold">
              <UserRound className="size-4 text-primary" />
              Venta
            </h3>
            <dl className="divide-y divide-black/5 rounded-[1.25rem] border border-black/5 px-4">
              {employee && (
                <DetailRow
                  label="Empleado responsable"
                  value={`${employee.employee.firstName} ${employee.employee.lastName}`}
                />
              )}
              {manager && employee && (
                <DetailRow
                  label="Registrado por"
                  value={`${employee.registeredBy.firstName} ${employee.registeredBy.lastName}`}
                />
              )}
              <DetailRow label="Cliente" value={customerName} />
              {employee?.payments.map((payment) => (
                <DetailRow
                  key={payment.paymentMethodId}
                  label={payment.methodName}
                  value={formatArs(payment.amount)}
                />
              ))}
            </dl>
          </section>

          <section>
            <h3 className="mb-2 flex items-center gap-2 font-semibold"><WalletCards className="size-4 text-primary" />Comisión</h3>
            <dl className="divide-y divide-black/5 rounded-[1.25rem] border border-black/5 px-4">
              {employee ? (
                <>
                  <DetailRow label="Comisión devengada" value={formatArs(employee.commission.total)} />
                  {employee.service && (
                    <DetailRow
                      label={`${employee.service.name} (${employee.service.commission.rate}%)`}
                      value={formatArs(employee.service.commission.amount)}
                    />
                  )}
                  {employee.products.map((product) => (
                    <DetailRow
                      key={product.id}
                      label={`${product.name} (${product.commission.rate}%)`}
                      value={formatArs(product.commission.amount)}
                    />
                  ))}
                  {[employee.service?.commission, ...employee.products.map((product) => product.commission)]
                    .filter((commission) => commission?.authorizedBy)
                    .map((commission, index) => (
                      <DetailRow
                        key={`authorized-by-${index}`}
                        label="Autorizado por"
                        value={`${commission?.authorizedBy?.firstName} ${commission?.authorizedBy?.lastName}`}
                      />
                    ))}
                  {manager && <DetailRow label="Neto barbería" value={formatArs(employee.commission.barbershopNet)} />}
                </>
              ) : (
                <DetailRow label="Tu ganancia" value={formatArs((income as EmployeeIncomeListItem).employeeCommission)} />
              )}
            </dl>
            {employee?.service?.commission?.fullCommission && (
              <p className="mt-2 text-xs font-medium text-primary">Servicio otorgado al 100% al empleado.</p>
            )}
            {income.status === "voided" && (
              <p className="mt-2 text-xs text-muted-foreground">Importes excluidos de las métricas activas.</p>
            )}
          </section>

          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Package className="size-3.5" />
            ID: {income.id}
          </p>
        </div>

        <SheetFooter className="border-t border-black/5 bg-white px-6 py-4">
          {canVoid && income.status === "active" ? (
            <Button type="button" variant="destructive" onClick={() => onVoid?.(income)}>Anular venta</Button>
          ) : income.status === "active" ? (
            <p className="text-center text-xs text-muted-foreground">Venta de solo lectura</p>
          ) : (
            <p className="text-center text-xs text-muted-foreground">Esta venta ya fue anulada</p>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
