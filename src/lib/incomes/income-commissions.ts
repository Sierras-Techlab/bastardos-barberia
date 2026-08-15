import type {
  CommissionPreviewSnapshot,
  CommissionPreviewInput,
  IncomePayment,
} from "@/types/income-commissions";
import type { IncomeStatus } from "@/types/income";

export const calculateCommissionPreview = (
  input: CommissionPreviewInput,
): CommissionPreviewSnapshot => {
  const isOwner = input.responsibleRole === "owner";
  const line = (subtotal: number, baseRate: number, fullRequested: boolean) => {
    const fullCommission = !isOwner && fullRequested && subtotal > 0;
    const rate = isOwner ? 0 : fullCommission ? 100 : baseRate;
    return { subtotal, rate, amount: Math.round((subtotal * rate) / 100), fullCommission, authorizedBy: null };
  };
  const service = input.serviceBase > 0
    ? line(input.serviceBase, input.serviceRate, input.grantFullServiceCommission)
    : null;
  const products = input.products.map((product) => line(product.price * product.quantity, input.productRate, product.grantFullCommission));
  const total = (service?.amount ?? 0) + products.reduce((sum, product) => sum + product.amount, 0);
  const gross = input.serviceBase + products.reduce((sum, product) => sum + product.subtotal, 0);

  return {
    service,
    products,
    total,
    barbershopNet: gross - total,
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
