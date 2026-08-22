import type { IncomeListItem } from "@/types/income";

export const getIncomePaymentLabel = (income: IncomeListItem) => {
  if (income.payments.length > 1) return `Combinado (${income.payments.length} medios)`;
  return income.payments[0]?.methodName ?? "Sin medio de pago";
};

export const getIncomeCommissionAmount = (income: IncomeListItem) =>
  income.commission.total;

export const getIncomeKindLabel = (income: IncomeListItem): string => {
  if (income.sourceType === "fixed_subscription") return "Mensualidad";
  if (income.subscription) return "Suscripción";
  const hasService = Boolean(income.service);
  const hasProducts = income.products.length > 0;
  if (hasService && hasProducts) return "Combinado";
  if (hasService) return "Servicio";
  if (hasProducts) return "Productos";
  return "Ingreso";
};

export const getIncomeDescription = (income: IncomeListItem) => {
  if (income.sourceType === "fixed_subscription" && income.subscription) {
    return `Mensualidad ${income.subscription.label}`;
  }
  return getIncomePaymentLabel(income);
};
