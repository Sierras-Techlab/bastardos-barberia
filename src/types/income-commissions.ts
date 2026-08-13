import type { UserRole } from "@/types/income";
export type { CreateIncomeInput as CreateIncomeV2Input, IncomePayment } from "@/types/income";

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
