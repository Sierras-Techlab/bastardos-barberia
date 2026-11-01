import { z } from "zod";
import type { SafeUser } from "@/lib/auth/types";
import type { CreateIncomeInput, IncomeListQuery } from "@/types/income";

const employeeSchema = z.object({ id: z.uuid(), firstName: z.string(), lastName: z.string() }).strict();
const paymentSchema = z.object({
  paymentMethodId: z.uuid(),
  methodName: z.string().min(1),
  amount: z.number().int().positive(),
  basisPoints: z.number().int().min(0).max(10000).nullable().optional(),
}).strict();
const itemCommissionSchema = z.object({
  subtotal: z.number().int().nonnegative(),
  catalogSubtotal: z.number().int().nonnegative().optional(),
  chargedSubtotal: z.number().int().nonnegative().optional(),
  adjustmentAmount: z.number().int().optional(),
  rate: z.number().int().min(0).max(100),
  amount: z.number().int().nonnegative(),
  fullCommission: z.boolean(),
  authorizedBy: employeeSchema.nullable(),
}).strict();
const managerServiceSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  price: z.number().int().nonnegative().optional(),
  catalogUnitPrice: z.number().int().nonnegative(),
  chargedUnitPrice: z.number().int().nonnegative(),
  catalogSubtotal: z.number().int().nonnegative(),
  chargedSubtotal: z.number().int().nonnegative(),
  adjustmentAmount: z.number().int(),
  priceOverrideReason: z.string().nullable().optional(),
  commission: itemCommissionSchema,
}).strict();
const legacyServiceSchema = serviceSchemaBackwardCompatible();
const managerProductSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  unitPrice: z.number().int().nonnegative().optional(),
  catalogUnitPrice: z.number().int().nonnegative(),
  chargedUnitPrice: z.number().int().nonnegative(),
  catalogSubtotal: z.number().int().nonnegative(),
  chargedSubtotal: z.number().int().nonnegative(),
  adjustmentAmount: z.number().int(),
  priceOverrideReason: z.string().nullable().optional(),
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
  payments: z.array(paymentSchema),
  commission: commissionSchema,
  total: z.number().int().nonnegative(),
  grossTotal: z.number().int().nonnegative(),
  sourceType: z.enum(["sale", "fixed_subscription", "chair_rental"]).optional(),
  subscription: z.object({
    sourceType: z.literal("fixed_subscription"),
    period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    label: z.string(),
    monthlyPrice: z.number().int().nonnegative(),
    employeeEarning: z.number().int().nonnegative(),
    barbershopNet: z.number().int().nonnegative(),
  }).strict().nullable().optional(),
  chairRentalPeriod: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).nullable().optional(),
  paidAt: z.iso.datetime({ offset: true }).nullable().optional(),
  chairRental: z.object({ sourceType: z.literal("chair_rental"), period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), paidAt: z.iso.datetime({ offset: true }).nullable() }).strict().nullable().optional(),
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
const compositionAmountsSchema = z.object({
  grossTotal: z.number().int().nonnegative(),
  commissionTotal: z.number().int().nonnegative(),
  barbershopNet: z.number().int().nonnegative(),
}).strict().refine((amounts) => amounts.grossTotal === amounts.commissionTotal + amounts.barbershopNet, "Los importes del concepto no concilian.");
const incomeCompositionSchema = z.object({
  sales: compositionAmountsSchema,
  subscriptions: compositionAmountsSchema,
  chairRentals: compositionAmountsSchema.refine((amounts) => amounts.commissionTotal === 0, "El alquiler no genera comisión."),
}).strict();
const managerMetricsSchema = z.object({
  grossTotal: z.number().nonnegative(),
  commissionTotal: z.number().nonnegative(),
  barbershopNet: z.number().nonnegative(),
  count: z.number().int().nonnegative(),
  average: z.number().nonnegative(),
  paymentTotals: z.array(z.object({ paymentMethodId: z.uuid(), name: z.string().min(1), amount: z.number().int().nonnegative() }).strict()),
  composition: incomeCompositionSchema.optional(),
}).strict().superRefine((metrics, context) => {
  if (!metrics.composition) return;
  for (const key of ["grossTotal", "commissionTotal", "barbershopNet"] as const) {
    const sum = Object.values(metrics.composition).reduce((total, amounts) => total + amounts[key], 0);
    if (sum !== metrics[key]) context.addIssue({ code: "custom", path: ["composition"], message: "El desglose no coincide con el total del período." });
  }
});

export const paginatedIncomesSchema = z.object({
  items: z.array(managerIncomeResponseSchema),
  metrics: managerMetricsSchema,
  pagination: z.object({ page: z.number().int().positive(), pageSize: z.number().int().positive(), total: z.number().int().nonnegative(), totalPages: z.number().int().nonnegative() }).strict(),
}).strict();

export const employeePaginatedIncomesSchema = z.object({
  items: z.array(employeeIncomeResponseSchema),
  metrics: z.object({ count: z.number().int().nonnegative(), employeeCommissionTotal: z.number().int().nonnegative() }).strict(),
  pagination: z.object({ page: z.number().int().positive(), pageSize: z.number().int().positive(), total: z.number().int().nonnegative(), totalPages: z.number().int().nonnegative() }).strict(),
}).strict();
export const incomeResponsibleEmployeesSchema = z.array(employeeSchema);
export type IncomeScope = { requestingUserId: string; canViewAll: boolean; userId: string | null };
export type ManagerIncomeDetail = z.infer<typeof managerIncomeResponseSchema>;
export type PaginatedIncomes = z.infer<typeof paginatedIncomesSchema>;
export type EmployeeIncomeDetail = z.infer<typeof employeeIncomeResponseSchema>;
export type EmployeePaginatedIncomes = z.infer<typeof employeePaginatedIncomesSchema>;
export type IncomeRepository = {
  create(actor: SafeUser, input: CreateIncomeInput): Promise<ManagerIncomeDetail | EmployeeIncomeDetail>;
  list(scope: IncomeScope, query: IncomeListQuery): Promise<PaginatedIncomes | EmployeePaginatedIncomes>;
  listResponsibleEmployees(requestingUserId: string): Promise<Array<{ id: string; firstName: string; lastName: string }>>;
  findById(scope: IncomeScope, id: string): Promise<ManagerIncomeDetail | EmployeeIncomeDetail | null>;
  void(id: string, actorId: string): Promise<ManagerIncomeDetail | EmployeeIncomeDetail | null>;
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
