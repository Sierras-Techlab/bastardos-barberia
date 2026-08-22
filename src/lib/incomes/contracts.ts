import { z } from "zod";
import type { SafeUser } from "@/lib/auth/types";
import type { CreateIncomeInput, Income, IncomeListItem, IncomeListQuery, PaginatedIncomes } from "@/types/income";

const employeeSchema = z.object({ id: z.uuid(), firstName: z.string(), lastName: z.string() }).strict();
const paymentSchema = z.object({ paymentMethodId: z.uuid(), methodName: z.string().min(1), amount: z.number().int().positive() }).strict();
const itemCommissionSchema = z.object({
  subtotal: z.number().int().nonnegative(),
  catalogSubtotal: z.number().int().nonnegative(),
  chargedSubtotal: z.number().int().nonnegative(),
  adjustmentAmount: z.number().int(),
  rate: z.number().int().min(0).max(100),
  amount: z.number().int().nonnegative(),
  fullCommission: z.boolean(),
  authorizedBy: employeeSchema.nullable(),
}).strict();
const managerServiceSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  catalogUnitPrice: z.number().int().nonnegative(),
  chargedUnitPrice: z.number().int().nonnegative(),
  catalogSubtotal: z.number().int().nonnegative(),
  chargedSubtotal: z.number().int().nonnegative(),
  adjustmentAmount: z.number().int(),
  commission: itemCommissionSchema,
}).strict();
const legacyServiceSchema = serviceSchemaBackwardCompatible();
const managerProductSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  catalogUnitPrice: z.number().int().nonnegative(),
  chargedUnitPrice: z.number().int().nonnegative(),
  catalogSubtotal: z.number().int().nonnegative(),
  chargedSubtotal: z.number().int().nonnegative(),
  adjustmentAmount: z.number().int(),
  quantity: z.number().int().positive(),
  commission: itemCommissionSchema,
}).strict();
const legacyProductSchema = productSchemaBackwardCompatible();
const commissionSchema = z.object({
  total: z.number().int().nonnegative(),
  barbershopNet: z.number().int().nonnegative(),
}).strict();
export const incomeResponseSchema = z.object({
  id: z.uuid(), createdAt: z.iso.datetime({ offset: true }), businessDate: z.iso.date(), employee: employeeSchema,
  registeredBy: employeeSchema,
  customer: employeeSchema.nullable(), service: legacyServiceSchema.nullable(),
  products: z.array(legacyProductSchema),
  payments: z.array(paymentSchema).min(1), commission: commissionSchema,
  total: z.number().int().positive(), status: z.enum(["active", "voided"]),
}).strict();
export const managerIncomeResponseSchema = z.object({
  id: z.uuid(),
  createdAt: z.iso.datetime({ offset: true }),
  businessDate: z.iso.date(),
  employee: employeeSchema,
  registeredBy: employeeSchema,
  customer: employeeSchema.nullable(),
  service: managerServiceSchema.nullable(),
  products: z.array(managerProductSchema),
  payments: z.array(paymentSchema).min(1),
  commission: commissionSchema,
  total: z.number().int().nonnegative(),
  grossTotal: z.number().int().nonnegative(),
  status: z.enum(["active", "voided"]),
}).strict();
const employeeConceptSchema = z.object({
  id: z.uuid(),
  type: z.enum(["service", "product"]),
  name: z.string(),
  quantity: z.number().int().positive(),
  earning: z.number().int().nonnegative(),
}).strict();
export const employeeIncomeResponseSchema = z.object({
  id: z.uuid(),
  createdAt: z.iso.datetime({ offset: true }),
  businessDate: z.iso.date(),
  customer: employeeSchema.nullable(),
  concepts: z.array(employeeConceptSchema).min(1),
  employeeCommission: z.number().int().nonnegative(),
  status: z.enum(["active", "voided"]),
}).strict();
export const paginatedIncomesSchema = z.object({
  items: z.array(incomeResponseSchema),
  metrics: z.object({ grossTotal: z.number().nonnegative(), commissionTotal: z.number().nonnegative(), barbershopNet: z.number().nonnegative(), count: z.number().int().nonnegative(), average: z.number().nonnegative(), paymentTotals: z.array(z.object({ paymentMethodId: z.uuid(), name: z.string().min(1), amount: z.number().int().nonnegative() }).strict()) }).strict(),
  pagination: z.object({ page: z.number().int().positive(), pageSize: z.number().int().positive(), total: z.number().int().nonnegative(), totalPages: z.number().int().nonnegative() }).strict(),
}).strict();

export const employeePaginatedIncomesSchema = z.object({
  items: z.array(employeeIncomeResponseSchema),
  metrics: z.object({ count: z.number().int().nonnegative(), employeeCommissionTotal: z.number().int().nonnegative() }).strict(),
  pagination: z.object({ page: z.number().int().positive(), pageSize: z.number().int().positive(), total: z.number().int().nonnegative(), totalPages: z.number().int().nonnegative() }).strict(),
}).strict();
export const incomeResponsibleEmployeesSchema = z.array(employeeSchema);
export type IncomeScope = { requestingUserId: string; canViewAll: boolean; userId: string | null };
export type IncomeRepository = {
  create(actor: SafeUser, input: CreateIncomeInput): Promise<Income>;
  list(scope: IncomeScope, query: IncomeListQuery): Promise<PaginatedIncomes>;
  listResponsibleEmployees(requestingUserId: string): Promise<Array<{ id: string; firstName: string; lastName: string }>>;
  findById(scope: IncomeScope, id: string): Promise<IncomeListItem | null>;
  void(id: string, actorId: string): Promise<IncomeListItem | null>;
};
export type IncomeDependencies = { incomes: IncomeRepository };

function serviceSchemaBackwardCompatible() {
  return z.object({
    id: z.uuid(),
    name: z.string(),
    price: z.number().int().positive(),
    catalogUnitPrice: z.number().int().nonnegative().optional(),
    chargedUnitPrice: z.number().int().nonnegative().optional(),
    catalogSubtotal: z.number().int().nonnegative().optional(),
    chargedSubtotal: z.number().int().nonnegative().optional(),
    adjustmentAmount: z.number().int().optional(),
    commission: itemCommissionSchema,
  }).strict();
}

function productSchemaBackwardCompatible() {
  return z.object({
    id: z.uuid(),
    name: z.string(),
    unitPrice: z.number().int().positive(),
    catalogUnitPrice: z.number().int().nonnegative().optional(),
    chargedUnitPrice: z.number().int().nonnegative().optional(),
    catalogSubtotal: z.number().int().nonnegative().optional(),
    chargedSubtotal: z.number().int().nonnegative().optional(),
    adjustmentAmount: z.number().int().optional(),
    quantity: z.number().int().positive(),
    commission: itemCommissionSchema,
  }).strict();
}
