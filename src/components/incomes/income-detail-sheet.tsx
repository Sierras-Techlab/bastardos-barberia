"use client";

import { Banknote, CreditCard, Package, Scissors, UserRound } from "lucide-react";

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
import type { IncomeListItem, UserRole } from "@/types/income";

type IncomeDetailSheetProps = {
  income: IncomeListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canVoid?: boolean;
  onVoid?: (income: IncomeListItem) => void;
  viewerRole?: UserRole;
};

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-start justify-between gap-4 py-2.5">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="text-right font-medium">{value}</dd>
  </div>
);

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
  const payments = income.payments;
  const PaymentIcon = payments.some((payment) => payment.method === "cash")
    ? Banknote
    : CreditCard;

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
          <section className="rounded-[1.35rem] bg-[#f6f5f2] p-4">
            <p className="text-xs font-medium tracking-[0.16em] text-primary uppercase">
              Total
            </p>
            <p
              className={`mt-1 text-3xl font-semibold ${
                income.status === "voided" ? "text-muted-foreground line-through" : ""
              }`}
            >
              {formatArs(income.total)}
            </p>
          </section>

          <section>
            <h3 className="mb-2 flex items-center gap-2 font-semibold">
              <Scissors className="size-4 text-primary" />
              Concepto
            </h3>
            <div className="divide-y divide-black/5 rounded-[1.25rem] border border-black/5 px-4">
              {income.service && (
                <DetailRow
                  label={income.service.name}
                  value={formatArs(income.service.price)}
                />
              )}
              {income.products.map((product) => (
                <DetailRow
                  key={product.id}
                  label={`${product.quantity} × ${product.name}`}
                  value={formatArs(product.unitPrice * product.quantity)}
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
              <DetailRow
                label="Empleado responsable"
                value={`${income.employee.firstName} ${income.employee.lastName}`}
              />
              {manager && <DetailRow label="Registrado por" value={`${income.registeredBy.firstName} ${income.registeredBy.lastName}`} />}
              <DetailRow label="Cliente" value={customerName} />
              {payments.map((payment) => <DetailRow key={payment.method} label={payment.method === "cash" ? "Efectivo" : "Transferencia"} value={formatArs(payment.amount)} />)}
            </dl>
          </section>

          <section>
            <h3 className="mb-2 flex items-center gap-2 font-semibold"><PaymentIcon className="size-4 text-primary" />Comisión</h3>
            <dl className="divide-y divide-black/5 rounded-[1.25rem] border border-black/5 px-4">
              <DetailRow label="Comisión devengada" value={formatArs(income.commission.total)} />
              {income.service && <DetailRow label={`${income.service.name} (${income.service.commission.rate}%)`} value={formatArs(income.service.commission.amount)} />}
              {income.products.map((product) => <DetailRow key={product.id} label={`${product.name} (${product.commission.rate}%)`} value={formatArs(product.commission.amount)} />)}
              {[income.service?.commission, ...income.products.map((product) => product.commission)].filter((commission) => commission?.authorizedBy).map((commission, index) => (
                <DetailRow
                  key={`authorized-by-${index}`}
                  label="Autorizado por"
                  value={`${commission?.authorizedBy?.firstName} ${commission?.authorizedBy?.lastName}`}
                />
              ))}
              {manager && <DetailRow label="Neto barbería" value={formatArs(income.commission.barbershopNet)} />}
            </dl>
            {income.service?.commission?.fullCommission && <p className="mt-2 text-xs font-medium text-primary">Servicio otorgado al 100% al empleado.</p>}
            {income.status === "voided" && <p className="mt-2 text-xs text-muted-foreground">Importes excluidos de las métricas activas.</p>}
          </section>

          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Package className="size-3.5" />
            ID: {income.id}
          </p>
        </div>

        <SheetFooter className="border-t border-black/5 bg-white px-6 py-4">
          {canVoid && income.status === "active" ? <Button type="button" variant="destructive" onClick={() => onVoid?.(income)}>Anular venta</Button> : income.status === "active" ? <p className="text-center text-xs text-muted-foreground">Venta de solo lectura</p> : <p className="text-center text-xs text-muted-foreground">Esta venta ya fue anulada</p>}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
