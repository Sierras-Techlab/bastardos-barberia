import type {
  CatalogProduct,
  CreateProductInput,
  StockAdjustment,
  UpdateProductInput,
} from "@/types/product";

type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
    fields?: Record<string, string[]>;
  };
};

export class ProductApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ProductApiError";
  }
}

const request = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init);
  const body = (await response.json()) as ApiErrorBody & { data?: T };

  if (!response.ok) {
    throw new ProductApiError(
      response.status,
      body.error?.code ?? "INTERNAL_ERROR",
      body.error?.message ?? "No se pudo completar la operación.",
      body.error?.fields,
    );
  }

  return body.data as T;
};

const jsonRequest = (method: "POST" | "PATCH", body: unknown) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export type ProductClient = {
  create(input: CreateProductInput): Promise<CatalogProduct>;
  update(id: string, input: UpdateProductInput): Promise<CatalogProduct>;
  adjustStock(id: string, input: StockAdjustment): Promise<CatalogProduct>;
};

export const productClient: ProductClient = {
  create(input) {
    return request<CatalogProduct>(
      "/api/products",
      jsonRequest("POST", input),
    );
  },

  update(id, input) {
    return request<CatalogProduct>(
      `/api/products/${encodeURIComponent(id)}`,
      jsonRequest("PATCH", input),
    );
  },

  adjustStock(id, input) {
    return request<CatalogProduct>(
      `/api/products/${encodeURIComponent(id)}/stock-movements`,
      jsonRequest("POST", input),
    );
  },
};
