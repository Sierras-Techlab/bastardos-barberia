import { z } from "zod";

const paymentMethodNameSchema = z
  .string()
  .trim()
  .min(1, "Ingresá el nombre del medio de pago.")
  .max(80, "El nombre del medio de pago no puede superar los 80 caracteres.");

export const paymentMethodIdSchema = z.uuid("El medio de pago no es válido.");

export const createPaymentMethodSchema = z
  .object({ name: paymentMethodNameSchema })
  .strict();

export const updatePaymentMethodSchema = z
  .object({
    name: paymentMethodNameSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Indicá al menos un cambio para el medio de pago.",
  });
