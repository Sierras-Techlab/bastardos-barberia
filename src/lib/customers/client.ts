import type { FrontendCustomerEditorInput } from "@/lib/customers/frontend-customer-contracts";
import type { Customer, PaginatedCustomerVisits, UpdateCustomerInput } from "@/types/customer";

type ErrorBody = { error?: { code?: string; message?: string; fields?: Record<string, string[]> } };
export class CustomerApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly fields?: Record<string, string[]>) {
    super(message);
    this.name = "CustomerApiError";
  }
}
const request = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init);
  const body = (await response.json()) as ErrorBody & { data?: T };
  if (!response.ok) throw new CustomerApiError(response.status, body.error?.code ?? "INTERNAL_ERROR", body.error?.message ?? "No se pudo completar la operaciÃ³n.", body.error?.fields);
  return body.data as T;
};
const json = (method: "POST" | "PATCH", body: unknown) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export type CustomerClient = {
  create(input: FrontendCustomerEditorInput): Promise<Customer>;
  update(id: string, input: UpdateCustomerInput): Promise<Customer>;
  remove(id: string): Promise<{ id: string }>;
  listVisits(id: string, query: { page: number; pageSize: number }, signal?: AbortSignal): Promise<PaginatedCustomerVisits>;
};
export const customerClient: CustomerClient = {
  create: (input) => request<Customer>("/api/customers", json("POST", input)),
  update: (id, input) => request<Customer>(`/api/customers/${encodeURIComponent(id)}`, json("PATCH", input)),
  remove: (id) => request(`/api/customers/${encodeURIComponent(id)}`, { method: "DELETE" }),
  listVisits: (id, query, signal) => request(`/api/customers/${encodeURIComponent(id)}/visits?${new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) })}`, { cache: "no-store", signal }),
};
