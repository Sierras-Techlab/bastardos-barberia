"use client";

import { CircleCheck, CircleDollarSign, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { fixedCustomerPaymentClient, type FixedCustomerPaymentClient } from "@/lib/fixed-customer-payments/client";
import type { FixedCustomerMonth, PayFixedCustomerMonthInput } from "@/types/fixed-customer-payment";
import type { PaymentMethod } from "@/types/payment-method";

export type FixedCustomerPaymentDialogProps = {
  month: FixedCustomerMonth;
  currentUserId: string;
  currentUserRole: "owner" | "admin" | "employee";
  paymentMethods: PaymentMethod[];
  client?: FixedCustomerPaymentClient;
  onClose(): void;
  onPaid(updated: FixedCustomerMonth): void;
};

const currentMonthPeriod = (today = new Date()): string => {
  const month = String(today.getMonth() + 1).padStart(2, "0");
  return `${today.getFullYear()}-${month}`;
};

const formatPeriodLabel = (period: string): string => {
  const [year, month] = period.split("-");
  const date = new Date(Number(year), Number(month) - 1, 15);
  return new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(date);
};

const fieldClassName = "h-11 rounded-xl border-black/10 bg-[#f7f6f3] shadow-none focus:bg-white";

export const FixedCustomerPaymentDialog = ({
  month,
  currentUserId,
  currentUserRole,
  paymentMethods,
  client = fixedCustomerPaymentClient,
  onClose,
  onPaid,
}: FixedCustomerPaymentDialogProps) => {
  const isManager = currentUserRole === "owner" || currentUserRole === "admin";
  const monthlyPrice = month.viewer === "manager" ? month.monthlyPrice : 0;
  const customerName = `${month.customer.firstName} ${month.customer.lastName}`;
  const professionalName = `${month.responsibleProfessional.firstName} ${month.responsibleProfessional.lastName}`;
  const periodLabel = formatPeriodLabel(month.period);
  const alreadyPaid = month.status === "paid";
  const isCurrentPeriod = month.period === currentMonthPeriod();
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [basisPoints, setBasisPoints] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const activeMethods = useMemo(() => paymentMethods.filter((method) => method.isActive), [paymentMethods]);

  const selectedBasisTotal = (() => {
    const totals = Object.values(basisPoints);
    if (!totals.length) return 0;
    return totals.reduce((sum, value) => sum + value, 0);
  })();
  const basisExcess = selectedBasisTotal > 10000;
  const basisShort = selectedBasisTotal < 10000;

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const requestId = crypto.randomUUID();
      const payments: PayFixedCustomerMonthInput["payments"] = isManager
        ? selectedMethod
          ? [{ paymentMethodId: selectedMethod, amount: monthlyPrice }]
          : []
        : Object.entries(basisPoints)
            .filter(([, points]) => points > 0)
            .map(([paymentMethodId, points]) => ({ paymentMethodId, basisPoints: points }));
      if (payments.length === 0) {
        toast.error("Seleccioná un medio de pago antes de cobrar.");
        setSubmitting(false);
        return;
      }
      const updated = await client.pay({
        mode: isManager ? "manager" : "employee",
        requestId,
        customerId: month.customer.id,
        period: month.period,
        payments,
      });
      toast.success("Mensualidad cobrada correctamente.");
      onPaid(updated);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo registrar el cobro.");
    } finally {
      setSubmitting(false);
    }
  };

  return <Dialog open onOpenChange={(open) => !open && !submitting && onClose()}>
    <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto rounded-[1.6rem] p-5 sm:max-w-md">
      <form noValidate onSubmit={submit} className="space-y-5">
        <DialogHeader>
          <span className="mb-1 flex size-10 items-center justify-center rounded-2xl bg-red-50 text-primary"><CircleDollarSign className="size-5" /></span>
          <DialogTitle>Cobrar mensualidad</DialogTitle>
          <DialogDescription>{customerName} · {periodLabel} · profesional {professionalName}</DialogDescription>
        </DialogHeader>

        <div className="rounded-2xl border border-black/8 bg-[#f7f6f3] p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Estado</p>
          <p className="mt-1 text-base font-semibold">{alreadyPaid ? "Cobrada" : "Pendiente"}</p>
          {!isCurrentPeriod && <p className="mt-1 text-xs text-muted-foreground">Estás cobrando un período distinto al mes en curso.</p>}
        </div>

        {isManager ? (
          <div className="space-y-3">
            <div className="rounded-2xl border border-black/8 bg-white p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Importe total</p>
              <p className="mt-1 text-2xl font-semibold">$ {monthlyPrice.toLocaleString("es-AR")}</p>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Medio de pago</p>
              <div className="grid grid-cols-2 gap-2">
                {activeMethods.map((method) => <button key={method.id} type="button" onClick={() => setSelectedMethod(method.id === selectedMethod ? null : method.id)} className={`rounded-2xl border px-3 py-2.5 text-left text-sm font-medium ${selectedMethod === method.id ? "border-primary bg-red-50 text-primary" : "border-black/10 bg-white"}`}>
                  {method.name}
                </button>)}
                {activeMethods.length === 0 && <p className="text-sm text-muted-foreground">No hay medios de pago activos.</p>}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-2xl border border-black/8 bg-white p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Tu ganancia</p>
              <p className="mt-1 text-2xl font-semibold">$ {month.employeeEarning.toLocaleString("es-AR")}</p>
              {month.viewer === "employee" && <p className="mt-1 text-[11px] text-muted-foreground">El manager ve el detalle económico completo.</p>}
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Distribución por medio (basis points · 10000 = 100%)</p>
              <div className="space-y-2">
                {activeMethods.map((method) => <label key={method.id} className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate font-medium">{method.name}</span>
                  <Input aria-label={`Porcentaje para ${method.name}`} type="number" inputMode="numeric" min={0} max={10000} step={1} value={basisPoints[method.id] ?? ""} onChange={(event) => setBasisPoints((current) => ({ ...current, [method.id]: Math.max(0, Math.min(10000, Number(event.target.value || 0))) }))} className={`${fieldClassName} w-24 text-right`} />
                </label>)}
                {activeMethods.length === 0 && <p className="text-sm text-muted-foreground">No hay medios de pago activos.</p>}
              </div>
              <p className={`mt-2 text-xs ${basisExcess || basisShort ? "text-red-700" : "text-emerald-700"}`}>Total: {selectedBasisTotal} / 10000</p>
            </div>
          </div>
        )}

        <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Marcar este mes como cobrado registra un ingreso de suscripción y afecta la caja del día.
        </div>

        <DialogFooter className="-mx-5 -mb-5 flex flex-row items-center justify-end gap-2 p-5">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting} className="rounded-xl">Cancelar</Button>
          <Button type="submit" disabled={submitting || alreadyPaid || (isManager ? !selectedMethod : basisExcess || basisShort)} className="rounded-xl">
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <CircleCheck className="size-4" />}
            {alreadyPaid ? "Ya cobrada" : submitting ? "Cobrando..." : "Confirmar cobro"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
};