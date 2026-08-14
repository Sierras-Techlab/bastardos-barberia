import { z } from "zod";

const formProductSchema = z.object({ productId: z.string().min(1), quantity: z.number().int().positive(), grantFullCommission: z.boolean() }).strict();
const publicProductSchema = z.object({ productId: z.uuid(), quantity: z.number().int().positive().max(999), grantFullCommission: z.boolean() }).strict();
export const incomePaymentSchema = z.object({
  method: z.enum(["cash", "transfer"]),
  amount: z.number().int().positive(),
}).strict();

export const incomeFormSchema = z.object({
  employeeId: z.uuid("Seleccioná un empleado responsable."),
  customerId: z.string().nullable(),
  serviceId: z.string().nullable(),
  products: z.array(formProductSchema),
  paymentMode: z.enum(["cash", "transfer", "combined"]).nullable(),
  payments: z.array(z.object({ method: z.enum(["cash", "transfer"]), amount: z.number().int().nonnegative() }).strict()),
  grantFullServiceCommission: z.boolean(),
}).strict().refine((value) => value.serviceId !== null || value.products.length > 0, {
  message: "Seleccioná un servicio o agregá al menos un producto.", path: ["serviceId"],
}).refine((value) => value.paymentMode !== null, {
  message: "Seleccioná un medio de pago.", path: ["paymentMode"],
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
  payments: z.array(incomePaymentSchema).min(1).max(2).superRefine((payments, context) => {
    const methods = new Set(payments.map(({ method }) => method));
    if (methods.size !== payments.length) {
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
  userId: z.uuid().optional(), paymentMethod: z.enum(["cash", "transfer"]).optional(),
  kind: z.enum(["service", "products", "combined"]).optional(), status: z.enum(["active", "voided"]).optional(),
  page: z.number().int().positive().default(1), pageSize: z.number().int().min(1).max(100).default(10),
}).strict();

export type IncomeFormValues = z.infer<typeof incomeFormSchema>;
