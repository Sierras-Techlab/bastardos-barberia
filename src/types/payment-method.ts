export type PaymentMethod = {
  id: string;
  name: string;
  isActive: boolean;
};

export type PaymentMethodInput = { name: string };

export type PaymentMethodUpdate = {
  name?: string;
  isActive?: boolean;
};

export type IncomePayment = {
  paymentMethodId: string;
  methodName: string;
  amount: number;
};

export type IncomePaymentInput =
  | { paymentMethodId: string; amount: number }
  | { paymentMethodId: string; basisPoints: number };
