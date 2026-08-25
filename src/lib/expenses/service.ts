import { assertManager } from "@/lib/auth/authorization";
import { AppError } from "@/lib/auth/errors";
import type { SafeUser } from "@/lib/auth/types";
import type { ExpenseDependencies } from "@/lib/expenses/contracts";
import { expenseCategoryRepository, expenseRepository } from "@/lib/expenses/repository";
import type { CreateExpenseInput, ExpenseCategoryInput, ExpenseCategoryUpdate, ExpenseListQuery, UpdateExpenseInput, VoidExpenseInput } from "@/types/expense";

const defaults: ExpenseDependencies = { expenses: expenseRepository, categories: expenseCategoryRepository };
const manager = (actor: SafeUser) => assertManager(actor);
export const listExpenses = (actor: SafeUser, query: ExpenseListQuery, d = defaults) => { manager(actor); return d.expenses.list(actor.id, query); };
export const getExpense = async (actor: SafeUser, id: string, d = defaults) => { manager(actor); const value = await d.expenses.get(actor.id, id); if (!value) throw new AppError("EXPENSE_NOT_FOUND", "No encontramos el gasto.", 404); return value; };
export const createExpense = (actor: SafeUser, input: CreateExpenseInput, d = defaults) => { manager(actor); return d.expenses.create(actor.id, input); };
export const updateExpense = (actor: SafeUser, id: string, input: UpdateExpenseInput, d = defaults) => { manager(actor); return d.expenses.update(actor.id, id, input); };
export const voidExpense = (actor: SafeUser, id: string, input: VoidExpenseInput, d = defaults) => { manager(actor); return d.expenses.void(actor.id, id, input); };
export const getExpenseMonthSummary = (actor: SafeUser, month: string, d = defaults) => { manager(actor); return d.expenses.summary(actor.id, month); };
export const listExpenseCategories = (actor: SafeUser, d = defaults) => { manager(actor); return d.categories.list(actor.id); };
export const createExpenseCategory = (actor: SafeUser, input: ExpenseCategoryInput, d = defaults) => { manager(actor); return d.categories.create(actor.id, input); };
export const updateExpenseCategory = (actor: SafeUser, id: string, input: ExpenseCategoryUpdate, d = defaults) => { manager(actor); return d.categories.update(actor.id, id, input); };
export const deleteExpenseCategory = async (actor: SafeUser, id: string, d = defaults) => { manager(actor); return { id: await d.categories.remove(actor.id, id) }; };
