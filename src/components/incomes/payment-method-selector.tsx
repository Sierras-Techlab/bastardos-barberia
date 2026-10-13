"use client";

import { Equal, Plus, Split, Trash2, WalletCards } from "lucide-react";
import { useEffect, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatArs } from "@/lib/incomes/income-calculations";
import type { IncomePaymentInput, PaymentMethod } from "@/types/payment-method";

type AmountPayment = { paymentMethodId: string; amount: number };

const isAmountPayment = (payment: IncomePaymentInput): payment is AmountPayment =>
  "amount" in payment;

const distributeRemainder = (payments: AmountPayment[], total: number): AmountPayment[] => {
  if (payments.length === 0) return [];
  if (payments.length === 1) return [{ ...payments[0], amount: total }];

  let remaining = total;
  const editable = payments.slice(0, -1).map((payment) => {
    const amount = Math.min(Math.max(0, payment.amount), remaining);
    remaining -= amount;
    return { ...payment, amount };
  });
  return [
    ...editable,
    { ...payments[payments.length - 1], amount: remaining },
  ];
};

type Props = {
  mode?: "manager" | "employee";
  methods: PaymentMethod[];
  payments: IncomePaymentInput[];
  total?: number;
  onChange: (payments: IncomePaymentInput[]) => void;
  error?: string;
};

export const PaymentMethodSelector = ({ methods, payments, total = 0, onChange, error }: Props) => {
  const activeMethods = useMemo(() => methods.filter((method) => method.isActive), [methods]);
  const activeIds = useMemo(() => new Set(activeMethods.map((method) => method.id)), [activeMethods]);
  const activeKey = activeMethods.map((method) => method.id).join(":");

  useEffect(() => {
    const seen = new Set<string>();
    const valid = payments.filter((payment): payment is AmountPayment => {
      if (!isAmountPayment(payment)) return false;
      if (!activeIds.has(payment.paymentMethodId) || seen.has(payment.paymentMethodId)) return false;
      seen.add(payment.paymentMethodId);
      return true;
    });
    const next = valid.length > 0
      ? distributeRemainder(valid, total)
      : activeMethods[0] && total > 0
        ? [{ paymentMethodId: activeMethods[0].id, amount: total }]
        : [];

    if (JSON.stringify(next) !== JSON.stringify(payments)) onChange(next);
  }, [activeKey, activeIds, activeMethods, onChange, payments, total]);

  const amountPayments = payments.filter(isAmountPayment);
  const selectedIds = new Set(amountPayments.map((payment) => payment.paymentMethodId));
  const combined = amountPayments.length > 1;

  const selectSingle = (paymentMethodId: string) => {
    if (selectedIds.has(paymentMethodId)) return;
    if (amountPayments.length === 0) {
      onChange([{ paymentMethodId, amount: total }]);
      return;
    }
    onChange([...amountPayments, { paymentMethodId, amount: 0 }]);
  };

  const selectCombined = () => {
    if (combined) return;
    const first = amountPayments[0];
    const additional = activeMethods.find((method) => method.id !== first?.paymentMethodId);
    if (first && additional) onChange([first, { paymentMethodId: additional.id, amount: 0 }]);
  };

  const removePayment = (paymentMethodId: string) => {
    const remaining = amountPayments.filter((payment) => payment.paymentMethodId !== paymentMethodId);
    onChange(distributeRemainder(remaining, total));
  };

  const setAmount = (paymentMethodId: string, requestedAmount: number) => {
    const index = amountPayments.findIndex((payment) => payment.paymentMethodId === paymentMethodId);
    if (index < 0 || index === amountPayments.length - 1) return;
    const otherEditableTotal = amountPayments
      .slice(0, -1)
      .reduce((sum, payment, paymentIndex) => sum + (paymentIndex === index ? 0 : payment.amount), 0);
    const amount = Math.min(Math.max(0, Math.round(requestedAmount)), Math.max(0, total - otherEditableTotal));
    const next = amountPayments.map((payment, paymentIndex) =>
      paymentIndex === index ? { ...payment, amount } : payment,
    );
    onChange(distributeRemainder(next, total));
  };

  const splitInHalf = () => {
    if (amountPayments.length !== 2) return;
    const firstHalf = Math.floor(total / 2);
    onChange([
      { ...amountPayments[0], amount: firstHalf },
      { ...amountPayments[1], amount: total - firstHalf },
    ]);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {activeMethods.map((method) => {
          const isSelected = selectedIds.has(method.id);
          return (
            <Button key={method.id} type="button" variant={isSelected ? "default" : "outline"} size="sm" aria-pressed={isSelected} onClick={() => selectSingle(method.id)} className="rounded-xl">
              {isSelected ? <WalletCards /> : <Plus />}
              {method.name}
            </Button>
          );
        })}
        {activeMethods.length >= 2 && !combined && amountPayments.length < activeMethods.length && amountPayments.length > 0 && (
          <Button type="button" variant="ghost" size="sm" aria-pressed={false} onClick={selectCombined} className="rounded-xl">
            <Split /> Combinado
          </Button>
        )}
      </div>

      {combined && amountPayments.length === 2 && (
        <Button type="button" variant="outline" size="sm" onClick={splitInHalf} className="rounded-xl">
          <Equal /> Mitad y mitad
        </Button>
      )}

      {amountPayments.length > 0 && (
        <div className="space-y-2">
          {amountPayments.map((payment, index) => {
            const method = activeMethods.find((candidate) => candidate.id === payment.paymentMethodId);
            if (!method) return null;
            const isRemainder = combined && index === amountPayments.length - 1;
            return (
              <div key={method.id} className="flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2">
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{method.name}</span>
                  {isRemainder && <span className="text-xs text-muted-foreground">Resto</span>}
                </div>
                <span className="text-sm text-muted-foreground">$</span>
                <Input type="number" inputMode="numeric" min="0" max={total} step="1" value={String(payment.amount)} disabled={isRemainder || !combined} onChange={(event) => setAmount(method.id, Number(event.target.value || 0))} className="h-9 w-32 rounded-lg text-right" aria-label={`Monto en ${method.name}`} />
                <Button type="button" variant="ghost" size="icon" onClick={() => removePayment(method.id)} aria-label={`Quitar ${method.name}`} className="rounded-lg">
                  <Trash2 />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {combined && amountPayments.length > 0 && (
        <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          <span className="font-medium">Importe distribuido correctamente</span>
          <span className="text-xs">{amountPayments.length} medios</span>
        </div>
      )}

      {!combined && amountPayments.length > 0 && (
        <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          <span className="font-medium">Asignado {formatArs(amountPayments[0].amount)}</span>
          <span className="text-xs text-muted-foreground">Método único</span>
        </div>
      )}

      {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </div>
  );
};
