export type FixedCustomerPaymentStatus = "pending" | "paid";

export type FixedCustomerPaymentIdentity = {
  id: string;
  firstName: string;
  lastName: string;
};

export type FixedCustomerMonthBase = {
  customer: FixedCustomerPaymentIdentity;
  responsibleProfessional: FixedCustomerPaymentIdentity;
  period: string;
  status: FixedCustomerPaymentStatus;
  paidAt: string | null;
  incomeId: string | null;
  employeeEarning: number;
};

export type EmployeeFixedCustomerMonth = FixedCustomerMonthBase & {
  viewer: "employee";
};

export type ManagerFixedCustomerMonth = FixedCustomerMonthBase & {
  viewer: "manager";
  monthlyPrice: number;
};

export type FixedCustomerMonth = EmployeeFixedCustomerMonth | ManagerFixedCustomerMonth;

export type FixedCustomerMonthQuery = {
  period: string;
  employeeId?: string;
};

export type PayFixedCustomerMonthInput = {
  requestId: string;
  customerId: string;
  period: string;
  payments: ReadonlyArray<
    | { paymentMethodId: string; amount: number }
    | { paymentMethodId: string; basisPoints: number }
  >;
};