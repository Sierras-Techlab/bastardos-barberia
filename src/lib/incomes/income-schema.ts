import { z } from "zod";

const formProductSchema = z.object({ productId: z.string().min(1), quantity: z.number().int().positive(), grantFullCommission: z.boolean() }).strict();
const publicProductSchema = z.object({ productId: z.uuid(), quantity: z.number().int().positive().max(999), grantFullCommission: z.boolean() }).strict();
export const incomePaymentSchema = z.object({
  paymentMethodId: z.uuid(),
  amount: z.number().int().positive(),
}).strict();

const incomeFormPaymentSchema = z.object({
  paymentMethodId: z.uuid(),
  amount: z.number().int().nonnegative(),
}).strict();

export const employeeFormPaymentSchema = z.object({
  paymentMethodId: z.uuid(),
  basisPoints: z.number().int().min(0).max(10000),
}).strict();

export const priceOverrideSchema = z.object({
  chargedUnitPrice: z.number().int().nonnegative(),
  reason: z.string().trim().min(1).max(240),
}).strict();

const managerProductPriceOverrideSchema = z.record(
  z.uuid(),
  priceOverrideSchema,
);

const managerCreatePaymentSchema = incomePaymentSchema;
const employeeCreatePaymentSchema = z.object({
  paymentMethodId: z.uuid(),
  basisPoints: z.number().int().min(0).max(10000),
}).strict();

const sharedCreateRefinements = {
  atLeastOneLine: (value: { serviceId: string | null; products: Array<{ productId: string }> }) =>
    value.serviceId !== null || value.products.length > 0,
};

export const incomeFormSchema = z.object({
  employeeId: z.uuid("Seleccioná un empleado responsable."),
  customerId: z.string().nullable(),
  serviceId: z.string().nullable(),
  products: z.array(formProductSchema),
  payments: z.array(incomeFormPaymentSchema).min(1, "Seleccioná un medio de pago.").superRefine((payments, context) => {
    const ids = new Set<string>();
    for (const [index, payment] of payments.entries()) {
      if (ids.has(payment.paymentMethodId)) context.addIssue({ code: "custom", message: "Cada medio de pago puede aparecer una sola vez.", path: [index, "paymentMethodId"] });
      ids.add(payment.paymentMethodId);
    }
  }),
  grantFullServiceCommission: z.boolean(),
}).strict().refine((value) => value.serviceId !== null || value.products.length > 0, {
  message: "Seleccioná un servicio o agregá al menos un producto.", path: ["serviceId"],
});

const priceOverrideFormSchema = z.object({
  chargedUnitPrice: z.coerce.number().int().nonnegative(),
  reason: z.string().trim().min(1, "Indicá el motivo del cambio de precio."),
}).strict();

const productOverridesFormSchema = z.array(
  z.object({ productId: z.string(), override: priceOverrideFormSchema.nullable() }).strict(),
).default([]);

export const managerIncomeFormSchema = incomeFormSchema.extend({
  servicePriceOverride: priceOverrideFormSchema.nullable().default(null),
  productPriceOverrides: productOverridesFormSchema,
}).strict();

export const employeeIncomeFormSchema = incomeFormSchema.extend({
  servicePriceOverride: z.null().default(null),
  productPriceOverrides: z.array(z.unknown()).default([]),
}).strict();

export const employeeIncomeFormPaymentSchema = z.object({
  paymentMethodId: z.uuid(),
  basisPoints: z.coerce.number().int().min(0).max(10000),
}).strict();

const managerCreateBaseSchema = z.object({
  requestId: z.uuid(),
  employeeId: z.uuid(),
  customerId: z.uuid().nullable(),
  serviceId: z.uuid().nullable(),
  products: z.array(publicProductSchema).superRefine((products, context) => {
    const ids = new Set<string>();
    for (const [index, product] of products.entries()) {
      if (ids.has(product.productId)) context.addIssue({ code: "custom", message: "Cada producto puede aparecer una sola vez.", path: [index, "productId"] });
      ids.add(product.productId);
    }
  }),
  payments: z.array(managerCreatePaymentSchema).min(1).superRefine((payments, context) => {
    const methodIds = new Set(payments.map(({ paymentMethodId }) => paymentMethodId));
    if (methodIds.size !== payments.length) {
      context.addIssue({ code: "custom", message: "Cada medio de pago puede aparecer una sola vez." });
    }
  }),
  grantFullServiceCommission: z.boolean(),
  servicePriceOverride: priceOverrideSchema.optional(),
  productPriceOverrides: managerProductPriceOverrideSchema.optional(),
}).strict().superRefine((value, context) => {
  if (!sharedCreateRefinements.atLeastOneLine(value)) {
    context.addIssue({ code: "custom", message: "Seleccioná un servicio o agregá al menos un producto.", path: ["serviceId"] });
  }
  if (value.productPriceOverrides) {
    const productIds = new Set(value.products.map(({ productId }) => productId));
    for (const overrideId of Object.keys(value.productPriceOverrides)) {
      if (!productIds.has(overrideId)) {
        context.addIssue({ code: "custom", message: "priceOverride referencia un producto inexistente.", path: ["productPriceOverrides", overrideId] });
      }
    }
  }
});

const employeeCreateBaseSchema = z.object({
  requestId: z.uuid(),
  employeeId: z.uuid(),
  customerId: z.uuid().nullable(),
  serviceId: z.uuid().nullable(),
  products: z.array(publicProductSchema).superRefine((products, context) => {
    const ids = new Set<string>();
    for (const [index, product] of products.entries()) {
      if (ids.has(product.productId)) context.addIssue({ code: "custom", message: "Cada producto puede aparecer una sola vez.", path: [index, "productId"] });
      ids.add(product.productId);
    }
  }),
  payments: z.array(employeeCreatePaymentSchema).min(1).superRefine((payments, context) => {
    const total = payments.reduce((sum, payment) => sum + payment.basisPoints, 0);
    if (total !== 10000) {
      context.addIssue({ code: "custom", message: "Los porcentajes deben sumar 100%." });
    }
    const methodIds = new Set(payments.map(({ paymentMethodId }) => paymentMethodId));
    if (methodIds.size !== payments.length) {
      context.addIssue({ code: "custom", message: "Cada medio de pago puede aparecer una sola vez." });
    }
  }),
  grantFullServiceCommission: z.boolean(),
}).strict().superRefine((value, context) => {
  if (!sharedCreateRefinements.atLeastOneLine(value)) {
    context.addIssue({ code: "custom", message: "Seleccioná un servicio o agregá al menos un producto.", path: ["serviceId"] });
  }
});

export const managerCreateIncomeSchema = managerCreateBaseSchema;
export const employeeCreateIncomeSchema = employeeCreateBaseSchema;
export const createIncomeSchema = managerCreateBaseSchema;

export const incomeIdSchema = z.uuid("El ingreso no es válido.");
export const incomeListQuerySchema = z.object({
  query: z.string().trim().max(120).optional(), dateFrom: z.iso.date().optional(), dateTo: z.iso.date().optional(),
  userId: z.uuid().optional(), paymentMethodId: z.uuid().optional(),
  kind: z.enum(["service", "products", "combined", "subscription"]).optional(), status: z.enum(["active", "voided"]).optional(),
  page: z.number().int().positive().default(1), pageSize: z.number().int().min(1).max(100).default(10),
}).strict();

export type IncomeFormValues = z.infer<typeof incomeFormSchema>;
export type ManagerCreateIncomeValues = z.infer<typeof managerCreateIncomeSchema>;
export type EmployeeCreateIncomeValues = z.infer<typeof employeeCreateIncomeSchema>;
export type EmployeeFormPaymentValues = z.infer<typeof employeeFormPaymentSchema>;
export type PriceOverrideValues = z.infer<typeof priceOverrideSchema>;
