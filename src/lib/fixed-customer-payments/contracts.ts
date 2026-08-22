import type {
  FixedCustomerMonth,
  FixedCustomerMonthQuery,
  PayFixedCustomerMonthInput,
} from "@/types/fixed-customer-payment";

export type FixedCustomerPaymentsRepository = {
  list(
    actorId: string,
    canViewAll: boolean,
    query: FixedCustomerMonthQuery,
  ): Promise<FixedCustomerMonth[]>;
  pay(
    actorId: string,
    input: PayFixedCustomerMonthInput,
  ): Promise<FixedCustomerMonth>;
  get(
    actorId: string,
    canViewAll: boolean,
    customerId: string,
    period: string,
  ): Promise<FixedCustomerMonth | null>;
};

export type FixedCustomerPaymentsDependencies = {
  payments: FixedCustomerPaymentsRepository;
};