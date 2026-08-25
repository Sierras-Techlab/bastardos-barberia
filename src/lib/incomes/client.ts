import type { CreateIncomeInput, EmployeeIncomeListItem, IncomeListItem, IncomeListQuery, ManagerPaginatedIncomes, PaginatedIncomes, UserRole } from "@/types/income";
import {
  employeeIncomeResponseSchema,
  employeePaginatedIncomesSchema,
  managerIncomeResponseSchema,
  paginatedIncomesSchema,
} from "@/lib/incomes/contracts";

type ErrorBody = { error?: { code?: string; message?: string; fields?: Record<string, string[]> } };
export class IncomeApiError extends Error { constructor(readonly status: number, readonly code: string, message: string, readonly fields?: Record<string, string[]>) { super(message); this.name = "IncomeApiError"; } }
const request = async <T>(url: string, init?: RequestInit): Promise<T> => { const response = await fetch(url, init); const body = (await response.json()) as ErrorBody & { data?: T }; if (!response.ok) throw new IncomeApiError(response.status, body.error?.code ?? "INTERNAL_ERROR", body.error?.message ?? "No se pudo completar la operación.", body.error?.fields); return body.data as T; };
const json = (method: "POST", body: unknown) => ({ method, cache: "no-store" as const, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const queryString = (query: IncomeListQuery) => { const params = new URLSearchParams(); for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== "") params.set(key, String(value)); return params.toString(); };

const parsePaginatedForRole = (
  role: UserRole,
  payload: unknown,
): PaginatedIncomes => {
  const schema = role === "employee" ? employeePaginatedIncomesSchema : paginatedIncomesSchema;
  return schema.parse(payload) as PaginatedIncomes;
};

const parseIncomeDetailForRole = (
  role: UserRole,
  payload: unknown,
): IncomeListItem | EmployeeIncomeListItem => {
  const schema = role === "employee" ? employeeIncomeResponseSchema : managerIncomeResponseSchema;
  return schema.parse(payload) as IncomeListItem | EmployeeIncomeListItem;
};

export type IncomeClient = {
  create(role: UserRole, input: CreateIncomeInput): Promise<IncomeListItem | EmployeeIncomeListItem>;
  listAs(role: UserRole, query: IncomeListQuery): Promise<PaginatedIncomes>;
  list(query: IncomeListQuery): Promise<ManagerPaginatedIncomes>;
  getAs(role: UserRole, id: string): Promise<IncomeListItem | EmployeeIncomeListItem>;
  get(id: string): Promise<IncomeListItem>;
  void(id: string): Promise<IncomeListItem>;
};

export const incomeClient: IncomeClient = {
  create: async (role, input) => {
    const raw = await request<unknown>("/api/incomes", json("POST", input));
    return parseIncomeDetailForRole(role, raw);
  },
  listAs: async (role, query) => {
    const raw = await request<unknown>(`/api/incomes?${queryString(query)}`, { cache: "no-store" });
    return parsePaginatedForRole(role, raw);
  },
  list: async (query) => {
    const raw = await request<unknown>(`/api/incomes?${queryString(query)}`, { cache: "no-store" });
    return paginatedIncomesSchema.parse(raw) as ManagerPaginatedIncomes;
  },
  getAs: async (role, id) => {
    const raw = await request<unknown>(`/api/incomes/${encodeURIComponent(id)}`, { cache: "no-store" });
    return parseIncomeDetailForRole(role, raw);
  },
  get: async (id) => {
    const raw = await request<unknown>(`/api/incomes/${encodeURIComponent(id)}`, { cache: "no-store" });
    return managerIncomeResponseSchema.parse(raw) as unknown as IncomeListItem;
  },
  void: (id) => request<IncomeListItem>(`/api/incomes/${encodeURIComponent(id)}/void`, { method: "POST", cache: "no-store" }),
};
