import { withoutEmptyFixedSchedule, type FrontendCustomerEditorInput } from "@/lib/customers/frontend-customer-contracts";
import type { Customer } from "@/types/customer";
type ErrorBody = { error?: { code?: string; message?: string; fields?: Record<string, string[]> } };
export class CustomerApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly fields?: Record<string, string[]>) { super(message); this.name = "CustomerApiError"; }
}
const request = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init); const body = (await response.json()) as ErrorBody & { data?: T };
  if (!response.ok) throw new CustomerApiError(response.status, body.error?.code ?? "INTERNAL_ERROR", body.error?.message ?? "No se pudo completar la operación.", body.error?.fields);
  return body.data as T;
};
const json = (method: "POST" | "PATCH", body: unknown) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const explainPendingSchedule = (error: unknown, includesFixedSchedule: boolean): never => {
  if (includesFixedSchedule && error instanceof CustomerApiError && error.status === 400) {
    throw new CustomerApiError(400, "FIXED_SCHEDULE_BACKEND_PENDING", "El horario fijo todavía no está disponible en el servidor.");
  }
  throw error;
};
export type CustomerClient = { create(input: FrontendCustomerEditorInput): Promise<Customer>; update(id: string, input: Partial<FrontendCustomerEditorInput>): Promise<Customer>; remove(id: string): Promise<{ id: string }> };
export const customerClient: CustomerClient = {
  create: (input) => request<Customer>("/api/customers", json("POST", withoutEmptyFixedSchedule(input))).catch((error) => explainPendingSchedule(error, input.fixedSchedule !== null)),
  update: (id, input) => request<Customer>(`/api/customers/${encodeURIComponent(id)}`, json("PATCH", input)).catch((error) => explainPendingSchedule(error, "fixedSchedule" in input)),
  remove: (id) => request(`/api/customers/${encodeURIComponent(id)}`, { method: "DELETE" }),
};
