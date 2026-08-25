"use client";

import { useEffect, useState } from "react";
import { FixedCustomerPaymentDialog } from "@/components/fixed-customers/fixed-customer-payment-dialog";
import { fixedCustomerPaymentClient } from "@/lib/fixed-customer-payments/client";
import type { Customer } from "@/types/customer";
import type { FixedCustomerMonth } from "@/types/fixed-customer-payment";
import type { PaymentMethod } from "@/types/payment-method";

const currentMonthPeriod = (today = new Date()): string => {
  const month = String(today.getMonth() + 1).padStart(2, "0");
  return `${today.getFullYear()}-${month}`;
};

export type CustomersPaymentDialogProps = {
  customer: Customer;
  currentUserId: string;
  currentUserRole: "owner" | "admin" | "employee";
  paymentMethods: PaymentMethod[];
  period?: string;
  onClose(): void;
  onPaid(updated: FixedCustomerMonth): void;
};

export const CustomersPaymentDialog = ({
  customer,
  currentUserId,
  currentUserRole,
  paymentMethods,
  period,
  onClose,
  onPaid,
}: CustomersPaymentDialogProps) => {
  const [month, setMonth] = useState<FixedCustomerMonth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fixedCustomerPaymentClient.get(customer.id, period ?? currentMonthPeriod())
      .then((result) => {
        if (!active) return;
        if (!result) setError("El cliente no tiene un horario activo en este período.");
        else setMonth(result);
      })
      .catch((caught) => {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : "No se pudo cargar el mes.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [customer.id, period]);

  if (loading) return <p role="status" className="sr-only">Cargando mensualidad…</p>;
  if (error) return <div role="alert" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="rounded-2xl bg-white p-5 shadow-xl"><p className="text-sm text-red-700">{error}</p><button type="button" onClick={onClose} className="mt-3 rounded-xl border border-black/10 px-3 py-1.5 text-sm">Cerrar</button></div></div>;
  if (!month) return null;
  return <FixedCustomerPaymentDialog
    month={month}
    currentUserId={currentUserId}
    currentUserRole={currentUserRole}
    paymentMethods={paymentMethods}
    onClose={onClose}
    onPaid={onPaid}
  />;
};