import type { CashPaymentTotal } from "@/types/cash";

export const expectedPhysicalCash = (
  openingBalance: number,
  payments: ReadonlyArray<CashPaymentTotal>,
  cashPaymentMethodId: string,
): number => {
  const cashNet = payments
    .filter((payment) => payment.paymentMethodId === cashPaymentMethodId)
    .reduce((total, payment) => total + payment.netAmount, 0);
  return openingBalance + cashNet;
};

export const calculateDifference = (
  expectedCash: number,
  countedCash: number,
): number => countedCash - expectedCash;

export const differenceLabel = (difference: number | null): string => {
  if (difference === null) return "Sin conteo";
  if (difference === 0) return "Sin diferencia";
  if (difference > 0) return `Sobran $ ${difference.toLocaleString("es-AR")}`;
  return `Faltan $ ${Math.abs(difference).toLocaleString("es-AR")}`;
};