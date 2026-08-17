import type {
  CreateServiceInput,
  ServiceCatalogItem,
  UpdateServiceInput,
} from "@/types/service-catalog";

type ApiErrorBody = { error?: { code?: string; message?: string; fields?: Record<string, string[]> } };

export class ServiceApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ServiceApiError";
  }
}

const request = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init);
  const body = (await response.json()) as ApiErrorBody & { data?: T };
  if (!response.ok) {
    throw new ServiceApiError(
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

export type ServiceClient = {
  create(input: CreateServiceInput): Promise<ServiceCatalogItem>;
  update(id: string, input: UpdateServiceInput): Promise<ServiceCatalogItem>;
  remove(id: string): Promise<{ id: string }>;
};

export const serviceClient: ServiceClient = {
  create: (input) => request("/api/services", jsonRequest("POST", input)),
  update: (id, input) => request(`/api/services/${encodeURIComponent(id)}`, jsonRequest("PATCH", input)),
  remove: (id) => request(`/api/services/${encodeURIComponent(id)}`, { method: "DELETE" }),
};
