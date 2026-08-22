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
  authorizedBy?: import("@/types/income").Employee | null;
  serviceChargedBase?: number;
  products: Array<{
    productId: string;
    price: number;
    quantity: number;
    grantFullCommission: boolean;
    chargedUnitPrice?: number;
  }>;
};

export type IncomeItemCommissionSnapshot = {
  subtotal: number;
  catalogSubtotal: number;
  chargedSubtotal: number;
  adjustmentAmount: number;
  rate: number;
  amount: number;
  fullCommission: boolean;
  authorizedBy: import("@/types/income").Employee | null;
};

/** Alias for backwards compatibility with code that references the charged subtotal only. */
export type IncomeItemChargedSnapshot = IncomeItemCommissionSnapshot;

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
