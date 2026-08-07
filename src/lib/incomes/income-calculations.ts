import type { Product, Service } from "@/types/income";

type CalculableDraft = {
  serviceId: string | null;
  products: Array<{
    productId: string;
    quantity: number;
  }>;
};

export const calculateIncomeTotal = (
  draft: CalculableDraft,
  services: Service[],
  products: Product[],
) => {
  const serviceTotal =
    services.find((service) => service.id === draft.serviceId)?.price ?? 0;

  const productTotal = draft.products.reduce((total, item) => {
    const price =
      products.find((product) => product.id === item.productId)?.price ?? 0;

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
