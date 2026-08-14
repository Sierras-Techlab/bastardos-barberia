import type {
  CommissionPreviewInput,
  IncomeCommissionSnapshot,
  IncomePayment,
} from "@/types/income-commissions";
import type { IncomeStatus } from "@/types/income";

export const calculateCommissionPreview = (
  input: CommissionPreviewInput,
): IncomeCommissionSnapshot => {
  const isOwner = input.responsibleRole === "owner";
  const fullServiceCommission = !isOwner && input.grantFullServiceCommission && input.serviceBase > 0;
  const serviceRate = isOwner ? 0 : fullServiceCommission ? 100 : input.serviceRate;
  const serviceAmount = Math.round((input.serviceBase * serviceRate) / 100);
  const productRate = isOwner ? 0 : input.productRate;
  const productAmount = Math.round((input.productBase * productRate) / 100);
  const total = serviceAmount + productAmount;

  return {
    serviceBase: input.serviceBase,
    productBase: input.productBase,
    serviceRate,
    productRate,
    serviceAmount,
    productAmount,
    total,
    barbershopNet: input.serviceBase + input.productBase - total,
    fullServiceCommission,
  };
};

export const calculatePaymentBalance = (total: number, payments: IncomePayment[]) => {
  const allocated = payments.reduce((sum, payment) => sum + payment.amount, 0);
  return {
    allocated,
    remaining: Math.max(total - allocated, 0),
    excess: Math.max(allocated - total, 0),
  };
};

export const contributesToActiveMetrics = (status: IncomeStatus) => status === "active";
