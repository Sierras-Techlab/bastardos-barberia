import type { IncomeListItem } from "@/types/income";

export const getIncomePaymentLabel = (income: IncomeListItem) => {
  if (income.payments.length > 1) return `Combinado (${income.payments.length} medios)`;
  return income.payments[0]?.methodName ?? "Sin medio de pago";
};

export const getIncomeCommissionAmount = (income: IncomeListItem) =>
  income.commission.total;

export const getIncomeKindLabel = (income: IncomeListItem) => {
  if (income.sourceType === "fixed_subscription") return "Mensualidad";
  if (income.kind === "service") return "Servicio";
  if (income.kind === "products") return "Productos";
  if (income.kind === "combined") return "Combinado";
  return "Suscripción";
};

export const getIncomeDescription = (income: IncomeListItem) => {
  if (income.sourceType === "fixed_subscription" && income.subscription) {
    return `Mensualidad ${income.subscription.label}`;
  }
  return getIncomePaymentLabel(income);
};
