import type { IncomeListItem } from "@/types/income";

export const getIncomePaymentLabel = (income: IncomeListItem) => {
  if (income.payments.length > 1) return `Combinado (${income.payments.length} medios)`;
  return income.payments[0]?.methodName ?? "Sin medio de pago";
};

export const getIncomeCommissionAmount = (income: IncomeListItem) =>
  income.commission.total;
