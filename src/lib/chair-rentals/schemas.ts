import { z } from "zod";

export const periodSchema = z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/);
const amountSchema = z.number().int().positive().safe();

export const employeeCommercialAgreementSchema = z.object({
  serviceCommissionEnabled: z.boolean(),
  productCommissionEnabled: z.boolean(),
  chairRentalEnabled: z.boolean(),
  monthlyChairRentalAmount: amountSchema.nullable(),
  chairRentalEffectiveFrom: periodSchema.nullable(),
  chairRentalDueDay: z.number().int().min(1).max(28).nullable(),
}).strict().superRefine((value, context) => {
  const fields = ["monthlyChairRentalAmount", "chairRentalEffectiveFrom", "chairRentalDueDay"] as const;
  if (value.chairRentalEnabled && fields.some((field) => value[field] === null)) {
    for (const field of fields) {
      if (value[field] === null) context.addIssue({ code: "custom", path: [field], message: "Este dato es obligatorio con el alquiler activo." });
    }
  }
  if (!value.chairRentalEnabled && fields.some((field) => value[field] !== null)) {
    context.addIssue({ code: "custom", path: ["chairRentalEnabled"], message: "El alquiler deshabilitado debe quedar sin configuración." });
  }
});

export const agreementUpdateSchema = employeeCommercialAgreementSchema;
export const commercialAgreementSchema = employeeCommercialAgreementSchema;
export const employeeIdSchema = z.uuid();
export const rentalPaymentIdSchema = z.uuid();

export const confirmChairRentalSchema = z.object({
  period: periodSchema,
  paymentMethodId: z.uuid(),
  requestId: z.uuid(),
}).strict();

export const voidChairRentalSchema = z.object({
  reason: z.string().trim().min(1).max(500),
}).strict();
export const chairRentalConfirmationSchema = confirmChairRentalSchema;
export const chairRentalVoidSchema = voidChairRentalSchema;

export const chairRentalListQuerySchema = z.object({
  period: periodSchema.optional(),
  status: z.enum(["pending", "paid", "overdue", "voided"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).strict();
