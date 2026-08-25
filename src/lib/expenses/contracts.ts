import type { CreateExpenseInput, Expense, ExpenseCategory, ExpenseCategoryInput, ExpenseCategoryUpdate, ExpenseListQuery, ExpenseMonthSummary, ExpenseRevision, PaginatedExpenses, UpdateExpenseInput, VoidExpenseInput } from "@/types/expense";

export type ExpenseRepository = {
  list(actorId: string, query: ExpenseListQuery): Promise<PaginatedExpenses>;
  get(actorId: string, id: string): Promise<{ expense: Expense; revisions: ExpenseRevision[] } | null>;
  create(actorId: string, input: CreateExpenseInput): Promise<Expense>;
  update(actorId: string, id: string, input: UpdateExpenseInput): Promise<Expense>;
  void(actorId: string, id: string, input: VoidExpenseInput): Promise<Expense>;
  summary(actorId: string, month: string): Promise<ExpenseMonthSummary>;
};
export type ExpenseCategoryRepository = {
  list(actorId: string): Promise<ExpenseCategory[]>;
  create(actorId: string, input: ExpenseCategoryInput): Promise<ExpenseCategory>;
  update(actorId: string, id: string, input: ExpenseCategoryUpdate): Promise<ExpenseCategory>;
  remove(actorId: string, id: string): Promise<string>;
};
export type ExpenseDependencies = { expenses: ExpenseRepository; categories: ExpenseCategoryRepository };
