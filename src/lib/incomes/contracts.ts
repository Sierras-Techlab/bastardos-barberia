import { z } from "zod";
import type { CreateIncomeInput, Income, IncomeListItem, IncomeListQuery, PaginatedIncomes } from "@/types/income";

const employeeSchema = z.object({ id: z.uuid(), firstName: z.string(), lastName: z.string() }).strict();
const serviceSchema = z.object({ id: z.uuid(), name: z.string(), price: z.number().int().positive() }).strict();
export const incomeResponseSchema = z.object({
  id: z.uuid(), createdAt: z.iso.datetime({ offset: true }), businessDate: z.iso.date(), employee: employeeSchema,
  customer: employeeSchema.nullable(), service: serviceSchema.nullable(),
  products: z.array(z.object({ id: z.uuid(), name: z.string(), unitPrice: z.number().int().positive(), quantity: z.number().int().positive() }).strict()),
  paymentMethod: z.enum(["cash", "transfer"]), total: z.number().int().positive(), status: z.enum(["active", "voided"]),
}).strict();
export const paginatedIncomesSchema = z.object({
  items: z.array(incomeResponseSchema),
  metrics: z.object({ total: z.number().nonnegative(), count: z.number().int().nonnegative(), average: z.number().nonnegative(), cashTotal: z.number().nonnegative(), transferTotal: z.number().nonnegative() }).strict(),
  pagination: z.object({ page: z.number().int().positive(), pageSize: z.number().int().positive(), total: z.number().int().nonnegative(), totalPages: z.number().int().nonnegative() }).strict(),
}).strict();
export type IncomeScope = { requestingUserId: string; canViewAll: boolean; userId: string | null };
export type IncomeRepository = {
  create(actorId: string, input: CreateIncomeInput): Promise<Income>;
  list(scope: IncomeScope, query: IncomeListQuery): Promise<PaginatedIncomes>;
  findById(scope: IncomeScope, id: string): Promise<IncomeListItem | null>;
  void(id: string, actorId: string): Promise<IncomeListItem | null>;
};
export type IncomeDependencies = { incomes: IncomeRepository };
