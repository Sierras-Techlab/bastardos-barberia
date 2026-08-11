import { z } from "zod";

const formProductSchema = z.object({ productId: z.string().min(1), quantity: z.number().int().positive() }).strict();
const publicProductSchema = z.object({ productId: z.uuid(), quantity: z.number().int().positive().max(999) }).strict();

export const incomeFormSchema = z.object({
  customerId: z.string().nullable(),
  serviceId: z.string().nullable(),
  products: z.array(formProductSchema),
  paymentMethod: z.enum(["cash", "transfer"]).nullable(),
}).strict().refine((value) => value.serviceId !== null || value.products.length > 0, {
  message: "Seleccioná un servicio o agregá al menos un producto.", path: ["serviceId"],
}).refine((value) => value.paymentMethod !== null, {
  message: "Seleccioná un medio de pago.", path: ["paymentMethod"],
});

export const createIncomeSchema = z.object({
  requestId: z.uuid(),
  customerId: z.uuid().nullable(),
  serviceId: z.uuid().nullable(),
  products: z.array(publicProductSchema).superRefine((products, context) => {
    const ids = new Set<string>();
    for (const [index, product] of products.entries()) {
      if (ids.has(product.productId)) context.addIssue({ code: "custom", message: "Cada producto puede aparecer una sola vez.", path: [index, "productId"] });
      ids.add(product.productId);
    }
  }),
  paymentMethod: z.enum(["cash", "transfer"]),
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
