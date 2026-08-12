import type { IncomeListItem } from "@/types/income";

export const getIncomePaymentLabel = (income: IncomeListItem) => {
  if ((income.payments?.length ?? 0) > 1) return "Combinado" as const;
  const method = income.payments?.[0]?.method ?? income.paymentMethod;
  return method === "cash" ? "Efectivo" as const : "Transferencia" as const;
};

export const getIncomeCommissionState = (income: IncomeListItem) => income.commission
  ? { available: true as const, amount: income.commission.total }
  : { available: false as const, amount: null };
