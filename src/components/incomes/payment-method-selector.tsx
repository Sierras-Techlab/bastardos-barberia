"use client";

import { Plus, Split, Trash2, WalletCards } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
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

const selectClassName =
  "h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30";

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
      ? valid.length === 1 && payments.length > 1
        ? [{ paymentMethodId: valid[0].paymentMethodId, amount: total ?? 0 }]
        : valid
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
  const available = activeMethods.filter((method) => !selectedIds.has(method.id));
  const combined = payments.length > 1;
  const selectedMethodId = payments.length === 1 ? payments[0].paymentMethodId : null;

  const selectSingle = (paymentMethodId: string) => {
    if (mode === "manager") {
      onChange([{ paymentMethodId, amount: total ?? 0 }]);
    } else {
      onChange([{ paymentMethodId, basisPoints: 10000 }]);
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

  const setEmployeeBasis = (paymentMethodId: string, basisPoints: number) => {
    const rest = payments.filter((payment) => payment.paymentMethodId !== paymentMethodId);
    onChange([...rest, { paymentMethodId, basisPoints: Math.max(0, Math.min(10000, Math.round(basisPoints))) }]);
  };

  const employeeTotalBasis = payments.reduce(
    (sum, payment) => sum + (isEmployeePayment(payment) ? payment.basisPoints : 0),
    0,
  );
  const employeeRemainingBasis = 10000 - employeeTotalBasis;

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
              onClick={() => {
                if (isSelected) return;
                selectSingle(method.id);
              }}
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

      {mode === "manager" && combined && (
        <Button type="button" variant="ghost" size="sm" onClick={selectCombined} className="rounded-xl">
          <Split /> Combinar
        </Button>
      )}

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
                    inputMode="numeric"
                    min="0"
                    max="10000"
                    step="1"
                    value={String(payment.basisPoints)}
                    onChange={(event) => setEmployeeBasis(method.id, Number(event.target.value || 0))}
                    className="h-9 w-24 rounded-lg text-right"
                    aria-label={`Porcentaje en ${method.name}`}
                  />
                  <span className="text-xs text-muted-foreground">/10000</span>
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

      {mode === "manager" && payments.length > 0 && (
        <div className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${combined ? "bg-amber-50" : "bg-emerald-50"}`}>
          <span className="font-medium">{combined ? "Combinado" : "Saldo restante"}</span>
          <span className={combined ? "text-amber-700" : "text-emerald-700"}>
            {combined ? `${payments.length} medios` : `Asignado ${total ?? 0}`}
          </span>
        </div>
      )}

      {mode === "employee" && payments.length > 0 && (
        <div className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${employeeRemainingBasis === 0 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
          <span className="font-medium">Basis points</span>
          <span>{employeeTotalBasis} / 10000</span>
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