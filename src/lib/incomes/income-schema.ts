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

export const createIncomeSchema = z.object({
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
  payments: z.array(incomePaymentSchema).min(1).superRefine((payments, context) => {
    const methodIds = new Set(payments.map(({ paymentMethodId }) => paymentMethodId));
    if (methodIds.size !== payments.length) {
      context.addIssue({ code: "custom", message: "Cada medio de pago puede aparecer una sola vez." });
    }
  }),
  grantFullServiceCommission: z.boolean(),
}).strict().refine((value) => value.serviceId !== null || value.products.length > 0, {
  message: "Seleccioná un servicio o agregá al menos un producto.", path: ["serviceId"],
});

export const incomeIdSchema = z.uuid("El ingreso no es válido.");
export const incomeListQuerySchema = z.object({
  query: z.string().trim().max(120).optional(), dateFrom: z.iso.date().optional(), dateTo: z.iso.date().optional(),
  userId: z.uuid().optional(), paymentMethodId: z.uuid().optional(),
  kind: z.enum(["service", "products", "combined"]).optional(), status: z.enum(["active", "voided"]).optional(),
  page: z.number().int().positive().default(1), pageSize: z.number().int().min(1).max(100).default(10),
}).strict();

export type IncomeFormValues = z.infer<typeof incomeFormSchema>;
