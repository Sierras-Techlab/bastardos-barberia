import type { Product, Service } from "@/types/income";

type CalculableDraft = {
  serviceId: string | null;
  servicePriceOverride?: { chargedUnitPrice: number; reason?: string } | null;
  products: Array<{
    productId: string;
    quantity: number;
  }>;
  productPriceOverrides?: unknown[];
};

const isProductPriceOverride = (
  value: unknown,
): value is {
  productId: string;
  override: { chargedUnitPrice: number; reason?: string } | null;
} =>
  typeof value === "object" &&
  value !== null &&
  "productId" in value &&
  typeof value.productId === "string" &&
  "override" in value;

export const calculateIncomeTotal = (
  draft: CalculableDraft,
  services: Service[],
  products: Product[],
) => {
  const selectedService = services.find(
    (service) => service.id === draft.serviceId,
  );
  const serviceTotal = selectedService
    ? (draft.servicePriceOverride?.chargedUnitPrice ?? selectedService.price)
    : 0;

  const productTotal = draft.products.reduce((total, item) => {
    const product = products.find(({ id }) => id === item.productId);
    if (!product) return total;
    const override = draft.productPriceOverrides?.find(
      (candidate) =>
        isProductPriceOverride(candidate) &&
        candidate.productId === item.productId,
    );
    const price =
      isProductPriceOverride(override) && override.override
        ? override.override.chargedUnitPrice
        : product.price;

    return total + price * item.quantity;
  }, 0);

  return serviceTotal + productTotal;
};

export const formatArs = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);

const MAX_BASIS_POINTS = 10000;

export const allocateByBasisPoints = (
  total: number,
  basisPoints: number[],
): number[] => {
  if (basisPoints.length === 0) {
    throw new Error("Se requiere al menos un porcentaje para asignar el total.");
  }
  const sum = basisPoints.reduce((acc, value) => acc + value, 0);
  if (sum !== MAX_BASIS_POINTS) {
    throw new Error("Los porcentajes deben sumar 100% (10000 basis points).");
  }
  if (total === 0) {
    return basisPoints.map(() => 0);
  }
  const allocations = new Array<number>(basisPoints.length).fill(0);
  let allocated = 0;
  for (let index = 0; index < basisPoints.length - 1; index += 1) {
    const portion = Math.floor((total * basisPoints[index]) / MAX_BASIS_POINTS);
    allocations[index] = portion;
    allocated += portion;
  }
  allocations[allocations.length - 1] = total - allocated;
  return allocations;
};
