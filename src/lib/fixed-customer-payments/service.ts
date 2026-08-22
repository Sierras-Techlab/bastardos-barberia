import { AppError } from "@/lib/auth/errors";
import type { SafeUser } from "@/lib/auth/types";
import type { FixedCustomerPaymentsDependencies } from "@/lib/fixed-customer-payments/contracts";
import { fixedCustomerPaymentRepository } from "@/lib/fixed-customer-payments/repository";
import type { FixedCustomerMonthQuery, PayFixedCustomerMonthInput } from "@/types/fixed-customer-payment";

const notFound = () => new AppError("FIXED_MONTH_NOT_FOUND", "No encontramos el mes del cliente.", 404);
const notFoundError = { code: "FIXED_MONTH_NOT_FOUND", status: 404 };
const defaults: FixedCustomerPaymentsDependencies = { payments: fixedCustomerPaymentRepository };
const canViewAll = (actor: SafeUser) => actor.role.name === "owner" || actor.role.name === "admin";
const isEmployee = (actor: SafeUser) => actor.role.name === "employee";
const requireManagerFilter = (actor: SafeUser, query: FixedCustomerMonthQuery): FixedCustomerMonthQuery => {
  if (!canViewAll(actor) || query.employeeId === undefined) return query;
  if (isEmployee(actor)) return query;
  return query;
};

export const listFixedCustomerMonths = async (actor: SafeUser, query: FixedCustomerMonthQuery, dependencies: FixedCustomerPaymentsDependencies = defaults) => {
  const scopedQuery = requireManagerFilter(actor, query);
  if (isEmployee(actor) && scopedQuery.employeeId && scopedQuery.employeeId !== actor.id) {
    throw new AppError("FORBIDDEN", "Solo podés ver tus propios clientes fijos.", 403);
  }
  return dependencies.payments.list(actor.id, canViewAll(actor), scopedQuery);
};

export const payFixedCustomerMonth = async (actor: SafeUser, input: PayFixedCustomerMonthInput, dependencies: FixedCustomerPaymentsDependencies = defaults) => {
  if (!dependencies.payments.pay) throw notFoundError;
  return dependencies.payments.pay(actor.id, input);
};

export const getFixedCustomerMonth = async (actor: SafeUser, customerId: string, period: string, dependencies: FixedCustomerPaymentsDependencies = defaults) => {
  const month = await dependencies.payments.get(actor.id, canViewAll(actor), customerId, period);
  if (!month) throw notFound();
  return month;
};