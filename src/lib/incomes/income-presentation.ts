import type { IncomeListItem } from "@/types/income";

export const getIncomePaymentLabel = (income: IncomeListItem) => {
  if (income.payments.length > 1) return "Combinado" as const;
  const method = income.payments[0].method;
  return method === "cash" ? "Efectivo" as const : "Transferencia" as const;
};

export const getIncomeCommissionAmount = (income: IncomeListItem) =>
  income.commission.total;
