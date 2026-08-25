import type { EmployeeIncomeListItem, IncomeListItem, IncomeListRow } from "@/types/income";

const hasPayments = (row: IncomeListRow): row is IncomeListItem =>
  "payments" in row && Array.isArray((row as IncomeListItem).payments);

const hasConcepts = (row: IncomeListRow): row is EmployeeIncomeListItem =>
  "concepts" in row && Array.isArray((row as EmployeeIncomeListItem).concepts);

export const getIncomePaymentLabel = (income: IncomeListRow) => {
  if (hasPayments(income)) {
    if (income.payments.length > 1) return `Combinado (${income.payments.length} medios)`;
    return income.payments[0]?.methodName ?? "Sin medio de pago";
  }
  return "Sin medio de pago";
};

export const getIncomeCommissionAmount = (income: IncomeListRow): number => {
  if (hasPayments(income)) return income.commission.total;
  if (hasConcepts(income)) return income.employeeCommission;
  return 0;
};

export const getIncomeTotalAmount = (income: IncomeListRow): number => {
  if (hasPayments(income)) return income.total;
  return 0;
};

export const getIncomeKindLabel = (income: IncomeListRow): string => {
  if (hasPayments(income)) {
    if (income.sourceType === "fixed_subscription") return "Mensualidad";
    if (income.subscription) return "Suscripción";
    const hasService = Boolean(income.service);
    const hasProducts = income.products.length > 0;
    if (hasService && hasProducts) return "Combinado";
    if (hasService) return "Servicio";
    if (hasProducts) return "Productos";
  }
  if (hasConcepts(income)) {
    const hasService = income.concepts.some((concept) => concept.type === "service");
    const hasProduct = income.concepts.some((concept) => concept.type === "product");
    if (hasService && hasProduct) return "Combinado";
    if (hasService) return "Servicio";
    if (hasProduct) return "Productos";
  }
  return "Ingreso";
};

export const getIncomeDescription = (income: IncomeListRow) => {
  if (hasPayments(income) && income.sourceType === "fixed_subscription" && income.subscription) {
    return `Mensualidad ${income.subscription.label}`;
  }
  return getIncomePaymentLabel(income);
};
