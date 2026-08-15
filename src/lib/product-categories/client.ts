import type {
  ProductCategory,
  ProductCategoryInput,
  ProductCategoryUpdate,
} from "@/types/product-category";

type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
    fields?: Record<string, string[]>;
  };
};

export class ProductCategoryApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ProductCategoryApiError";
  }
}

const request = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init);
  const body = (await response.json()) as ApiErrorBody & { data?: T };

  if (!response.ok) {
    throw new ProductCategoryApiError(
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

export type ProductCategoryClient = {
  list(): Promise<ProductCategory[]>;
  get(id: string): Promise<ProductCategory>;
  create(input: ProductCategoryInput): Promise<ProductCategory>;
  update(id: string, input: ProductCategoryUpdate): Promise<ProductCategory>;
  deactivate(id: string): Promise<ProductCategory>;
  remove(id: string): Promise<{ id: string }>;
};

export const productCategoryClient: ProductCategoryClient = {
  async list() {
    return (await request<{ categories: ProductCategory[] }>(
      "/api/product-categories",
    )).categories;
  },

  get(id) {
    return request<ProductCategory>(
      `/api/product-categories/${encodeURIComponent(id)}`,
    );
  },

  create(input) {
    return request<ProductCategory>(
      "/api/product-categories",
      jsonRequest("POST", input),
    );
  },

  update(id, input) {
    return request<ProductCategory>(
      `/api/product-categories/${encodeURIComponent(id)}`,
      jsonRequest("PATCH", input),
    );
  },

  deactivate(id) {
    return request<ProductCategory>(
      `/api/product-categories/${encodeURIComponent(id)}`,
      jsonRequest("PATCH", { isActive: false }),
    );
  },

  remove(id) {
    return request<{ id: string }>(
      `/api/product-categories/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
  },
};
