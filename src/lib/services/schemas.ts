import { z } from "zod";

export const serviceIdSchema = z.uuid("El servicio no es válido.");

export const createServiceSchema = z
  .object({
    name: z.string().trim().min(1, "Ingresá el nombre del servicio.").max(120),
    price: z
      .number({ error: "Ingresá un precio válido." })
      .int("El precio debe ser un número entero.")
      .positive("El precio debe ser mayor a cero."),
  })
  .strict();

export const updateServiceSchema = z
  .object({
    name: z.string().trim().min(1, "Ingresá el nombre del servicio.").max(120).optional(),
    price: z
      .number({ error: "Ingresá un precio válido." })
      .int("El precio debe ser un número entero.")
      .positive("El precio debe ser mayor a cero.")
      .optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Indicá al menos un cambio para el servicio.",
  });
