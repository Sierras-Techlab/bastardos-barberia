import type { UserRole } from "@/types/income";
export type { CreateIncomeInput, IncomePaymentInput as IncomePayment } from "@/types/income";

export type CommissionUser = {
  id: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  serviceCommissionRate: number;
  productCommissionRate: number;
};

export type CommissionPreviewInput = {
  responsibleRole: UserRole;
  serviceBase: number;
  serviceRate: number;
  productRate: number;
  grantFullServiceCommission: boolean;
  products: Array<{ productId: string; price: number; quantity: number; grantFullCommission: boolean }>;
};

export type IncomeItemCommissionSnapshot = {
  subtotal: number;
  rate: number;
  amount: number;
  fullCommission: boolean;
  authorizedBy: import("@/types/income").Employee | null;
};

export type CommissionPreviewSnapshot = {
  service: IncomeItemCommissionSnapshot | null;
  products: IncomeItemCommissionSnapshot[];
  total: number;
  barbershopNet: number;
};

export type IncomeCommissionSnapshot = {
  total: number;
  barbershopNet: number;
};
