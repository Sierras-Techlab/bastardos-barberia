import { expenseCategorySchema, expenseDetailSchema, expenseMonthSummarySchema, expenseSchema, paginatedExpensesSchema } from "@/lib/expenses/schemas";
import type { CreateExpenseInput, Expense, ExpenseCategory, ExpenseCategoryInput, ExpenseCategoryUpdate, ExpenseListQuery, ExpenseMonthSummary, PaginatedExpenses, UpdateExpenseInput, VoidExpenseInput } from "@/types/expense";
import type { z } from "zod";
import { z as zod } from "zod";

export class ExpenseApiError extends Error { constructor(readonly status: number, readonly code: string, message: string, readonly fields?: Record<string, string[]>) { super(message); this.name = "ExpenseApiError"; } }
const request = async <T>(url: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const body = await response.json() as { data?: unknown; error?: { code?: string; message?: string; fields?: Record<string, string[]> } };
  if (!response.ok) throw new ExpenseApiError(response.status, body.error?.code ?? "INTERNAL_ERROR", body.error?.message ?? "No se pudo completar la operación.", body.error?.fields);
  return schema.parse(body.data);
};
const json = (method: "POST" | "PATCH", body: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const params = (query: Record<string, string | number | undefined>) => { const result = new URLSearchParams(); Object.entries(query).forEach(([key, value]) => { if (value !== undefined) result.set(key, String(value)); }); return result.toString(); };
export const expenseClient = {
  list(query: ExpenseListQuery): Promise<PaginatedExpenses> { return request(`/api/expenses?${params(query)}`, paginatedExpensesSchema); },
  get(id: string) { return request(`/api/expenses/${encodeURIComponent(id)}`, expenseDetailSchema); },
  create(input: CreateExpenseInput): Promise<Expense> { return request("/api/expenses", expenseSchema, json("POST", input)); },
  update(id: string, input: UpdateExpenseInput): Promise<Expense> { return request(`/api/expenses/${encodeURIComponent(id)}`, expenseSchema, json("PATCH", input)); },
  void(id: string, input: VoidExpenseInput): Promise<Expense> { return request(`/api/expenses/${encodeURIComponent(id)}/void`, expenseSchema, json("POST", input)); },
  summary(month: string): Promise<ExpenseMonthSummary> { return request(`/api/expenses/summary?${params({ month })}`, expenseMonthSummarySchema); },
};
export type ExpenseClient = typeof expenseClient;
export const expenseCategoryClient = {
  list(): Promise<ExpenseCategory[]> { return request("/api/expense-categories", expenseCategorySchema.array()); },
  create(input: ExpenseCategoryInput): Promise<ExpenseCategory> { return request("/api/expense-categories", expenseCategorySchema, json("POST", input)); },
  update(id: string, input: ExpenseCategoryUpdate): Promise<ExpenseCategory> { return request(`/api/expense-categories/${encodeURIComponent(id)}`, expenseCategorySchema, json("PATCH", input)); },
  remove(id: string): Promise<{ id: string }> { return request(`/api/expense-categories/${encodeURIComponent(id)}`, zod.object({ id: zod.uuid() }).strict(), { method: "DELETE" }); },
};
export type ExpenseCategoryClient = typeof expenseCategoryClient;
