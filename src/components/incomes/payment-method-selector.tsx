"use client";

import { Plus, Trash2, WalletCards } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { calculatePaymentBalance } from "@/lib/incomes/income-commissions";
import { cn } from "@/lib/utils";
import type { IncomePaymentInput, PaymentMethod } from "@/types/payment-method";

type Props = {
  methods: PaymentMethod[];
  payments: IncomePaymentInput[];
  total: number;
  onChange: (payments: IncomePaymentInput[]) => void;
  error?: string;
};

const selectClassName =
  "h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30";

export const PaymentMethodSelector = ({ methods, payments, total, onChange, error }: Props) => {
  const activeMethods = useMemo(() => methods.filter((method) => method.isActive), [methods]);
  const activeIds = useMemo(() => new Set(activeMethods.map((method) => method.id)), [activeMethods]);
  const activeKey = activeMethods.map((method) => method.id).join(":");
  const previousTotal = useRef(total);

  useEffect(() => {
    const seen = new Set<string>();
    const valid = payments.filter((payment) => {
      if (!activeIds.has(payment.paymentMethodId) || seen.has(payment.paymentMethodId)) return false;
      seen.add(payment.paymentMethodId);
      return true;
    });
    const next = valid.length > 0
      ? valid.length === 1 && payments.length > 1
        ? [{ ...valid[0], amount: total }]
        : valid
      : activeMethods[0]
        ? [{ paymentMethodId: activeMethods[0].id, amount: total }]
        : [];

    if (JSON.stringify(next) !== JSON.stringify(payments)) onChange(next);
  }, [activeKey, activeIds, activeMethods, onChange, payments, total]);

  useEffect(() => {
    const oldTotal = previousTotal.current;
    previousTotal.current = total;
    if (oldTotal !== total && payments.length === 1 && payments[0].amount === oldTotal) {
      onChange([{ ...payments[0], amount: total }]);
    }
  }, [onChange, payments, total]);

  const selectedIds = new Set(payments.map((payment) => payment.paymentMethodId));
  const available = activeMethods.filter((method) => !selectedIds.has(method.id));
  const balance = calculatePaymentBalance(total, payments);

  const update = (index: number, patch: Partial<IncomePaymentInput>) => {
    onChange(payments.map((payment, current) => current === index ? { ...payment, ...patch } : payment));
  };

  const remove = (index: number) => {
    const next = payments.filter((_, current) => current !== index);
    onChange(next.length === 1 ? [{ ...next[0], amount: total }] : next);
  };

  if (activeMethods.length === 0) {
    return <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error ?? "No hay medios de pago activos disponibles."}</p>;
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {payments.map((payment, index) => {
          const method = activeMethods.find((candidate) => candidate.id === payment.paymentMethodId);
          const options = activeMethods.filter((candidate) => candidate.id === payment.paymentMethodId || !selectedIds.has(candidate.id));
          return (
            <div key={`${payment.paymentMethodId}-${index}`} className="grid gap-2 rounded-2xl border border-black/5 bg-[#f6f5f2] p-3 sm:grid-cols-[minmax(0,1fr)_minmax(8rem,0.55fr)_auto] sm:items-end">
              <label className="space-y-1 text-xs font-medium text-muted-foreground">
                Medio de pago
                <select
                  aria-label={`Medio de pago ${index + 1}`}
                  value={payment.paymentMethodId}
                  onChange={(event) => update(index, { paymentMethodId: event.target.value })}
                  className={selectClassName}
                >
                  {options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-xs font-medium text-muted-foreground">
                Importe
                <Input
                  aria-label={`Monto con ${method?.name ?? `medio ${index + 1}`}`}
                  type="number"
                  min="0"
                  step="1"
                  value={payment.amount || ""}
                  onChange={(event) => update(index, { amount: Math.max(0, Math.trunc(Number(event.target.value) || 0)) })}
                  className="h-10 rounded-xl border-black/10 bg-white shadow-none"
                />
              </label>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Quitar ${method?.name ?? "medio de pago"}`}
                disabled={payments.length === 1}
                onClick={() => remove(index)}
              >
                <Trash2 />
              </Button>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="outline" className="rounded-xl" disabled={available.length === 0} onClick={() => onChange([...payments, { paymentMethodId: available[0].id, amount: 0 }])}>
          <Plus /> Agregar medio
        </Button>
        <p role="status" className={cn("flex items-center gap-1.5 text-xs font-medium", balance.remaining === 0 && balance.excess === 0 ? "text-emerald-700" : "text-destructive")}>
          <WalletCards className="size-3.5" />
          {balance.remaining > 0
            ? `Faltan $ ${balance.remaining.toLocaleString("es-AR")}`
            : balance.excess > 0
              ? `Sobran $ ${balance.excess.toLocaleString("es-AR")}`
              : "Importe distribuido correctamente"}
        </p>
      </div>
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
    </div>
  );
};
