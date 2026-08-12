import { z } from "zod";

const optionalEmailSchema = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? null : value,
  z.union([
    z.null(),
    z.string().trim().toLowerCase().pipe(z.email("Ingresá un email válido, sin ñ ni acentos.")),
  ]),
);
const phoneSchema = z.string().trim().refine(
  (value) => {
    const length = value.replace(/\D/g, "").length;
    return length >= 8 && length <= 15;
  },
  "Ingresá un teléfono válido.",
);

export const customerIdSchema = z.uuid("El cliente no es válido.");
export const createCustomerSchema = z.object({
  firstName: z.string().trim().min(1, "Ingresá el nombre.").max(80),
  lastName: z.string().trim().min(1, "Ingresá el apellido.").max(80),
  phone: phoneSchema,
  email: optionalEmailSchema,
}).strict();
export const updateCustomerSchema = z.object({
  firstName: z.string().trim().min(1, "Ingresá el nombre.").max(80).optional(),
  lastName: z.string().trim().min(1, "Ingresá el apellido.").max(80).optional(),
  phone: phoneSchema.optional(),
  email: optionalEmailSchema.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: "Indicá al menos un cambio para el cliente.",
});
