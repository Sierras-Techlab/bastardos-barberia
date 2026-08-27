import { z } from "zod";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha no es válida.");
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "El mes no es válido.");
const timestamp = z.iso.datetime({ offset: true });
const money = z.number().int().positive().safe();
const reason = z.string().trim().min(3).max(500);
const concept = z.string().trim().min(1).max(200);
const notes = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? null : value,
  z.string().trim().max(1000).nullable(),
);
export const expenseIdSchema = z.uuid();
export const expenseCategoryTypeSchema = z.enum(["fixed", "variable", "supplies"]);
export const expenseStatusSchema = z.enum(["active", "voided"]);

export const expenseCategorySchema = z.object({ id: z.uuid(), name: z.string(), type: expenseCategoryTypeSchema, isActive: z.boolean(), createdAt: timestamp, updatedAt: timestamp }).strict();
export const expenseSchema = z.object({
  id: z.uuid(), requestId: z.uuid(), accountingDate: date, categoryId: z.uuid(), categoryName: z.string(), categoryType: expenseCategoryTypeSchema,
  amount: money, concept: z.string(), notes: z.string().nullable(), paymentMethodId: z.uuid().nullable(), paymentMethodName: z.string().nullable(), status: expenseStatusSchema,
  createdBy: z.uuid(), createdAt: timestamp, updatedBy: z.uuid(), updatedAt: timestamp, voidedBy: z.uuid().nullable(), voidedAt: timestamp.nullable(), voidReason: z.string().nullable(),
}).strict();
export const expenseRevisionSchema = z.object({ id: z.uuid(), expenseId: z.uuid(), revisionNumber: z.number().int().positive(), changedBy: z.uuid(), changedAt: timestamp, reason: z.string(), previous: expenseSchema, next: expenseSchema }).strict();
export const expenseDetailSchema = z.object({ expense: expenseSchema, revisions: z.array(expenseRevisionSchema) }).strict();

export const createExpenseSchema = z.object({ requestId: z.uuid(), accountingDate: date, categoryId: z.uuid(), amount: money, concept, notes: notes.optional(), paymentMethodId: z.uuid().nullable().optional() }).strict();
export const updateExpenseSchema = z.object({ expectedUpdatedAt: timestamp, reason, accountingDate: date.optional(), categoryId: z.uuid().optional(), amount: money.optional(), concept: concept.optional(), notes: notes.optional(), paymentMethodId: z.uuid().nullable().optional() }).strict().refine((v) => Object.keys(v).some((key) => !["expectedUpdatedAt", "reason"].includes(key)), "Indicá al menos un cambio.");
export const voidExpenseSchema = z.object({ expectedUpdatedAt: timestamp, reason }).strict();
export const createExpenseCategorySchema = z.object({ name: z.string().trim().min(1).max(80), type: expenseCategoryTypeSchema }).strict();
export const updateExpenseCategorySchema = z.object({ name: z.string().trim().min(1).max(80).optional(), type: expenseCategoryTypeSchema.optional(), isActive: z.boolean().optional() }).strict().refine((v) => Object.keys(v).length > 0, "Indicá al menos un cambio.");

export const expenseListQuerySchema = z.object({ month: month.optional(), dateFrom: date.optional(), dateTo: date.optional(), categoryId: z.uuid().optional(), type: expenseCategoryTypeSchema.optional(), paymentMethodId: z.uuid().optional(), status: expenseStatusSchema.optional(), text: z.string().trim().max(100).optional(), page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20) }).strict().refine((v) => !v.month || (!v.dateFrom && !v.dateTo), "No combines mes con rango de fechas.").refine((v) => !v.dateFrom || !v.dateTo || v.dateFrom <= v.dateTo, "El rango de fechas no es válido.");
export const expenseMonthQuerySchema = z.object({ month }).strict();
const metrics = z.object({ total: z.number().int().nonnegative().safe(), count: z.number().int().nonnegative(), fixedTotal: z.number().int().nonnegative().safe(), variableTotal: z.number().int().nonnegative().safe(), suppliesTotal: z.number().int().nonnegative().safe() }).strict();
export const paginatedExpensesSchema = z.object({ items: z.array(expenseSchema), metrics, page: z.number().int().positive(), pageSize: z.number().int().positive(), total: z.number().int().nonnegative(), totalPages: z.number().int().nonnegative() }).strict();
export const expenseMonthSummarySchema = z.object({ month, grossIncome: z.number().int().nonnegative().safe(), commission: z.number().int().nonnegative().safe(), barbershopNet: z.number().int().safe(), expenses: z.number().int().nonnegative().safe(), operatingResult: z.number().int().safe(), fixedTotal: z.number().int().nonnegative().safe(), variableTotal: z.number().int().nonnegative().safe(), suppliesTotal: z.number().int().nonnegative().safe() }).strict();
