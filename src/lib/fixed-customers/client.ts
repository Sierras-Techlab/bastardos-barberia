import type { FixedCustomerOccurrence, FixedOccurrenceQuery, ResolveFixedOccurrenceInput } from "@/types/fixed-customer";

type ErrorBody = { error?: { code?: string; message?: string } };
export class FixedCustomerApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); this.name = "FixedCustomerApiError"; }
}
const request = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init);
  const body = (await response.json()) as ErrorBody & { data?: T };
  if (!response.ok) throw new FixedCustomerApiError(response.status, body.error?.code ?? "INTERNAL_ERROR", body.error?.message ?? "No se pudo completar la operaciÃ³n.");
  return body.data as T;
};
export const fixedCustomerClient = {
  list(query: FixedOccurrenceQuery) {
    const params = new URLSearchParams({ dateFrom: query.dateFrom, dateTo: query.dateTo });
    if (query.status) params.set("status", query.status);
    return request<FixedCustomerOccurrence[]>(`/api/fixed-customer-occurrences?${params}`, { cache: "no-store" });
  },
  resolve(id: string, input: ResolveFixedOccurrenceInput) {
    return request<FixedCustomerOccurrence>(`/api/fixed-customer-occurrences/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },
};
