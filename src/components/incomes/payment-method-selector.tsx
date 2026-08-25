"use client";

import { Plus, Split, Trash2, WalletCards } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatArs } from "@/lib/incomes/income-calculations";
import type { IncomePaymentInput, PaymentMethod } from "@/types/payment-method";

const isManagerPayment = (
  payment: IncomePaymentInput,
): payment is { paymentMethodId: string; amount: number } =>
  "amount" in payment;

const isEmployeePayment = (
  payment: IncomePaymentInput,
): payment is { paymentMethodId: string; basisPoints: number } =>
  "basisPoints" in payment;

type Props = {
  mode?: "manager" | "employee";
  methods: PaymentMethod[];
  payments: IncomePaymentInput[];
  total?: number;
  onChange: (payments: IncomePaymentInput[]) => void;
  error?: string;
};

export const PaymentMethodSelector = ({ mode = "manager", methods, payments, total, onChange, error }: Props) => {
  const activeMethods = useMemo(() => methods.filter((method) => method.isActive), [methods]);
  const activeIds = useMemo(() => new Set(activeMethods.map((method) => method.id)), [activeMethods]);
  const activeKey = activeMethods.map((method) => method.id).join(":");
  const previousTotal = useRef(total);

  useEffect(() => {
    if (mode === "employee") return;
    const seen = new Set<string>();
    const valid = payments.filter((payment) => {
      if (!isManagerPayment(payment)) return false;
      if (!activeIds.has(payment.paymentMethodId) || seen.has(payment.paymentMethodId)) return false;
      seen.add(payment.paymentMethodId);
      return true;
    });
    const next = valid.length > 0
      ? valid
      : activeMethods[0] && total
        ? [{ paymentMethodId: activeMethods[0].id, amount: total }]
        : [];

    if (JSON.stringify(next) !== JSON.stringify(payments)) onChange(next);
  }, [activeKey, activeIds, activeMethods, onChange, payments, total, mode]);

  useEffect(() => {
    if (mode === "employee" || !total) return;
    const oldTotal = previousTotal.current;
    previousTotal.current = total;
    if (oldTotal !== total && payments.length === 1 && isManagerPayment(payments[0]) && payments[0].amount === oldTotal) {
      onChange([{ paymentMethodId: payments[0].paymentMethodId, amount: total }]);
    }
  }, [onChange, payments, total, mode]);

  const selectedIds = new Set(payments.map((payment) => payment.paymentMethodId));
  const combined = payments.length > 1;

  const selectSingle = (paymentMethodId: string) => {
    if (selectedIds.has(paymentMethodId)) return;
    if (payments.length === 0) {
      if (mode === "manager") {
        onChange([{ paymentMethodId, amount: total ?? 0 }]);
      } else {
        onChange([{ paymentMethodId, basisPoints: 10000 }]);
      }
      return;
    }
    if (mode === "manager") {
      onChange([...payments, { paymentMethodId, amount: 0 }]);
    } else {
      onChange([...payments, { paymentMethodId, basisPoints: 0 }]);
    }
  };

  const selectCombined = () => {
    if (combined) return;

    const first = payments[0];
    const current = first
      ? isManagerPayment(first)
        ? { paymentMethodId: first.paymentMethodId, amount: first.amount }
        : isEmployeePayment(first)
        ? { paymentMethodId: first.paymentMethodId, basisPoints: first.basisPoints }
        : null
      : null;
    const additional = activeMethods.find((method) => method.id !== current?.paymentMethodId);

    if (current && additional) {
      if (mode === "manager") {
        onChange([current as { paymentMethodId: string; amount: number }, { paymentMethodId: additional.id, amount: 0 }]);
      } else {
        onChange([current as { paymentMethodId: string; basisPoints: number }, { paymentMethodId: additional.id, basisPoints: 0 }]);
      }
    }
  };

  const removePayment = (paymentMethodId: string) => {
    onChange(payments.filter((payment) => payment.paymentMethodId !== paymentMethodId));
  };

  const setManagerAmount = (paymentMethodId: string, amount: number) => {
    const rest = payments.filter((payment) => payment.paymentMethodId !== paymentMethodId);
    onChange([...rest, { paymentMethodId, amount: Math.max(0, Math.round(amount)) }]);
  };

  const setEmployeePercentage = (paymentMethodId: string, percentage: number) => {
    const rest = payments.filter((payment) => payment.paymentMethodId !== paymentMethodId);
    const boundedPercentage = Math.max(0, Math.min(100, percentage));
    onChange([...rest, { paymentMethodId, basisPoints: Math.round(boundedPercentage * 100) }]);
  };

  const employeeTotalBasis = payments.reduce(
    (sum, payment) => sum + (isEmployeePayment(payment) ? payment.basisPoints : 0),
    0,
  );
  const employeeRemainingBasis = 10000 - employeeTotalBasis;
  const managerTotalAmount = payments.reduce(
    (sum, payment) => sum + (isManagerPayment(payment) ? payment.amount : 0),
    0,
  );
  const managerRemainingAmount = (total ?? 0) - managerTotalAmount;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {activeMethods.map((method) => {
          const isSelected = selectedIds.has(method.id);
          return (
            <Button
              key={method.id}
              type="button"
              variant={isSelected ? "default" : "outline"}
              size="sm"
              aria-pressed={isSelected}
              onClick={() => selectSingle(method.id)}
              className="rounded-xl"
            >
              {isSelected ? <WalletCards /> : <Plus />}
              {method.name}
            </Button>
          );
        })}
        {mode === "manager" && activeMethods.length >= 2 && !combined && payments.length < activeMethods.length && payments.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={false}
            onClick={selectCombined}
            className="rounded-xl"
          >
            <Split /> Combinado
          </Button>
        )}
      </div>

      {payments.length > 0 && (
        <div className="space-y-2">
          {payments.map((payment) => {
            const method = activeMethods.find((candidate) => candidate.id === payment.paymentMethodId);
            if (!method) return null;
            if (mode === "manager" && isManagerPayment(payment)) {
              return (
                <div key={method.id} className="flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2">
                  <span className="flex-1 text-sm font-medium">{method.name}</span>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    step="1"
                    value={String(payment.amount)}
                    onChange={(event) => setManagerAmount(method.id, Number(event.target.value || 0))}
                    className="h-9 w-28 rounded-lg text-right"
                    aria-label={`Monto en ${method.name}`}
                  />
                  <Button type="button" variant="ghost" size="icon" onClick={() => removePayment(method.id)} aria-label={`Quitar ${method.name}`} className="rounded-lg">
                    <Trash2 />
                  </Button>
                </div>
              );
            }
            if (mode === "employee" && isEmployeePayment(payment)) {
              return (
                <div key={method.id} className="flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2">
                  <span className="flex-1 text-sm font-medium">{method.name}</span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max="100"
                    step="0.01"
                    value={String(payment.basisPoints / 100)}
                    onChange={(event) => setEmployeePercentage(method.id, Number(event.target.value || 0))}
                    className="h-9 w-24 rounded-lg text-right"
                    aria-label={`Porcentaje en ${method.name}`}
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removePayment(method.id)} aria-label={`Quitar ${method.name}`} className="rounded-lg">
                    <Trash2 />
                  </Button>
                </div>
              );
            }
            return null;
          })}
        </div>
      )}

      {mode === "manager" && combined && payments.length > 0 && (
        <div className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${
          managerRemainingAmount === 0
            ? "bg-emerald-50 text-emerald-700"
            : managerRemainingAmount > 0
              ? "bg-amber-50 text-amber-700"
              : "bg-red-50 text-red-700"
        }`}>
          <span className="font-medium">
            {managerRemainingAmount === 0
              ? "Importe distribuido correctamente"
              : managerRemainingAmount > 0
                ? `Faltan ${formatArs(managerRemainingAmount)}`
                : `Sobran ${formatArs(Math.abs(managerRemainingAmount))}`}
          </span>
          <span className="text-xs">{payments.length} medios</span>
        </div>
      )}

      {mode === "manager" && !combined && payments.length > 0 && isManagerPayment(payments[0]) && (
        <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          <span className="font-medium">Asignado {formatArs(payments[0].amount)}</span>
          <span className="text-xs text-muted-foreground">Método único</span>
        </div>
      )}

      {mode === "employee" && payments.length > 0 && (
        <div className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${employeeRemainingBasis === 0 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
          <span className="font-medium">Porcentaje distribuido</span>
          <span>{employeeTotalBasis / 100}% / 100%</span>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
};
