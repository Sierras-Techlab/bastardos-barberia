import type { CreateIncomeInput, Income, IncomeListItem, IncomeListQuery, PaginatedIncomes } from "@/types/income";
import type { CreateIncomeV2Input } from "@/types/income-commissions";
type ErrorBody = { error?: { code?: string; message?: string; fields?: Record<string, string[]> } };
export class IncomeApiError extends Error { constructor(readonly status: number, readonly code: string, message: string, readonly fields?: Record<string, string[]>) { super(message); this.name = "IncomeApiError"; } }
const request = async <T>(url: string, init?: RequestInit): Promise<T> => { const response = await fetch(url, init); const body = (await response.json()) as ErrorBody & { data?: T }; if (!response.ok) throw new IncomeApiError(response.status, body.error?.code ?? "INTERNAL_ERROR", body.error?.message ?? "No se pudo completar la operación.", body.error?.fields); return body.data as T; };
const json = (method: "POST", body: unknown) => ({ method, cache: "no-store" as const, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const queryString = (query: IncomeListQuery) => { const params = new URLSearchParams(); for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== "") params.set(key, String(value)); return params.toString(); };
export type IncomeClient = { create(input: CreateIncomeInput): Promise<Income>; createV2(input: CreateIncomeV2Input): Promise<Income>; list(query: IncomeListQuery): Promise<PaginatedIncomes>; get(id: string): Promise<IncomeListItem>; void(id: string): Promise<IncomeListItem> };
export const incomeClient: IncomeClient = {
  create: (input) => request("/api/incomes", json("POST", input)),
  createV2: (input) => request("/api/incomes", json("POST", input)),
  list: (query) => request(`/api/incomes?${queryString(query)}`, { cache: "no-store" }),
  get: (id) => request(`/api/incomes/${encodeURIComponent(id)}`, { cache: "no-store" }),
  void: (id) => request(`/api/incomes/${encodeURIComponent(id)}/void`, { method: "POST", cache: "no-store" }),
};
