export type ExpenseCategoryType = "fixed" | "variable" | "supplies";
export type ExpenseStatus = "active" | "voided";

export type ExpenseCategory = {
  id: string;
  name: string;
  type: ExpenseCategoryType;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Expense = {
  id: string;
  requestId: string;
  accountingDate: string;
  categoryId: string;
  categoryName: string;
  categoryType: ExpenseCategoryType;
  amount: number;
  concept: string;
  notes: string | null;
  paymentMethodId: string | null;
  paymentMethodName: string | null;
  status: ExpenseStatus;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
  voidedBy: string | null;
  voidedAt: string | null;
  voidReason: string | null;
};

export type ExpenseRevision = {
  id: string;
  expenseId: string;
  revisionNumber: number;
  changedBy: string;
  changedAt: string;
  reason: string;
  previous: Expense;
  next: Expense;
};

export type ExpenseDetail = { expense: Expense; revisions: ExpenseRevision[] };

export type CreateExpenseInput = {
  requestId: string;
  accountingDate: string;
  categoryId: string;
  amount: number;
  concept: string;
  notes?: string | null;
  paymentMethodId?: string | null;
};

export type UpdateExpenseInput = {
  expectedUpdatedAt: string;
  reason: string;
  accountingDate?: string;
  categoryId?: string;
  amount?: number;
  concept?: string;
  notes?: string | null;
  paymentMethodId?: string | null;
};

export type VoidExpenseInput = { expectedUpdatedAt: string; reason: string };
export type ExpenseCategoryInput = { name: string; type: ExpenseCategoryType };
export type ExpenseCategoryUpdate = { name?: string; type?: ExpenseCategoryType; isActive?: boolean };

export type ExpenseListQuery = {
  month?: string;
  dateFrom?: string;
  dateTo?: string;
  categoryId?: string;
  type?: ExpenseCategoryType;
  paymentMethodId?: string;
  status?: ExpenseStatus;
  text?: string;
  page: number;
  pageSize: number;
};

export type ExpenseMetrics = {
  total: number;
  count: number;
  fixedTotal: number;
  variableTotal: number;
  suppliesTotal: number;
};

export type PaginatedExpenses = { items: Expense[]; metrics: ExpenseMetrics; page: number; pageSize: number; total: number; totalPages: number };

export type ExpenseMonthSummary = {
  month: string;
  grossIncome: number;
  commission: number;
  barbershopNet: number;
  expenses: number;
  operatingResult: number;
  fixedTotal: number;
  variableTotal: number;
  suppliesTotal: number;
};
