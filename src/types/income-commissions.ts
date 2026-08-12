import type { UserRole } from "@/types/income";

export type CommissionUser = {
  id: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  serviceCommissionRate: number;
  productCommissionRate: number;
};

export type IncomePayment = {
  method: "cash" | "transfer";
  amount: number;
};

export type CreateIncomeV2Input = {
  requestId: string;
  employeeId: string;
  customerId: string | null;
  serviceId: string | null;
  products: Array<{ productId: string; quantity: number }>;
  payments: IncomePayment[];
  grantFullServiceCommission: boolean;
};

export type CommissionPreviewInput = {
  serviceBase: number;
  productBase: number;
  serviceRate: number;
  productRate: number;
  grantFullServiceCommission: boolean;
};

export type IncomeCommissionSnapshot = {
  serviceBase: number;
  productBase: number;
  serviceRate: number;
  productRate: number;
  serviceAmount: number;
  productAmount: number;
  total: number;
  barbershopNet: number;
  fullServiceCommission: boolean;
};
