import type {
  CommissionPreviewInput,
  IncomeCommissionSnapshot,
  IncomePayment,
} from "@/types/income-commissions";
import type { IncomeStatus } from "@/types/income";

export const calculateCommissionPreview = (
  input: CommissionPreviewInput,
): IncomeCommissionSnapshot => {
  const fullServiceCommission = input.grantFullServiceCommission && input.serviceBase > 0;
  const serviceRate = fullServiceCommission ? 100 : input.serviceRate;
  const serviceAmount = Math.round((input.serviceBase * serviceRate) / 100);
  const productAmount = Math.round((input.productBase * input.productRate) / 100);
  const total = serviceAmount + productAmount;

  return {
    serviceBase: input.serviceBase,
    productBase: input.productBase,
    serviceRate,
    productRate: input.productRate,
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
