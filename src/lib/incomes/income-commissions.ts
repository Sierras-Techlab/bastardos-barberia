import type {
  CommissionPreviewSnapshot,
  CommissionPreviewInput,
  IncomePayment,
} from "@/types/income-commissions";
import type { IncomeStatus } from "@/types/income";

type LineSnapshot = {
  catalogSubtotal: number;
  chargedSubtotal: number;
  adjustmentAmount: number;
  rate: number;
  amount: number;
  fullCommission: boolean;
  authorizedBy: import("@/types/income").Employee | null;
};

const buildLineSnapshot = ({
  chargedSubtotal,
  baseRate,
  fullRequested,
  authorizedBy,
  isOwner,
}: {
  chargedSubtotal: number;
  baseRate: number;
  fullRequested: boolean;
  authorizedBy: import("@/types/income").Employee | null;
  isOwner: boolean;
}): LineSnapshot => {
  if (chargedSubtotal <= 0) {
    return {
      subtotal: 0,
      catalogSubtotal: 0,
      chargedSubtotal: 0,
      adjustmentAmount: 0,
      rate: 0,
      amount: 0,
      fullCommission: false,
      authorizedBy: null,
    };
  }
  const fullCommission = !isOwner && fullRequested;
  const rate = fullCommission ? 100 : baseRate;
  return {
    subtotal: chargedSubtotal,
    catalogSubtotal: chargedSubtotal,
    chargedSubtotal,
    adjustmentAmount: 0,
    rate,
    amount: Math.round((chargedSubtotal * rate) / 100),
    fullCommission,
    authorizedBy: fullCommission ? authorizedBy : null,
  };
};

export const calculateCommissionPreview = (
  input: CommissionPreviewInput,
): CommissionPreviewSnapshot => {
  const isOwner = input.responsibleRole === "owner";
  const authorizedBy = input.authorizedBy ?? null;
  const service = input.serviceBase > 0 || input.serviceChargedBase !== undefined
    ? buildLineSnapshot({
      chargedSubtotal: input.serviceChargedBase ?? input.serviceBase,
      baseRate: input.serviceRate,
      fullRequested: input.grantFullServiceCommission,
      authorizedBy,
      isOwner,
    })
    : null;

  if (service) {
    service.catalogSubtotal = input.serviceBase;
    service.adjustmentAmount = service.chargedSubtotal - service.catalogSubtotal;
    service.subtotal = service.chargedSubtotal;
  }

  const products = input.products.map((product) => {
    const catalogSubtotal = product.price * product.quantity;
    const chargedUnitPrice = product.chargedUnitPrice ?? product.price;
    const chargedSubtotal = chargedUnitPrice * product.quantity;
    const snapshot = buildLineSnapshot({
      chargedSubtotal,
      baseRate: input.productRate,
      fullRequested: product.grantFullCommission,
      authorizedBy,
      isOwner,
    });
    snapshot.catalogSubtotal = catalogSubtotal;
    snapshot.adjustmentAmount = snapshot.chargedSubtotal - catalogSubtotal;
    snapshot.subtotal = snapshot.chargedSubtotal;
    return snapshot;
  });

  const total = (service?.amount ?? 0) + products.reduce((sum, product) => sum + product.amount, 0);
  const gross = (service?.chargedSubtotal ?? 0) + products.reduce((sum, product) => sum + product.chargedSubtotal, 0);
  const barbershopNet = gross - total;

  return {
    service,
    products,
    total,
    barbershopNet,
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
