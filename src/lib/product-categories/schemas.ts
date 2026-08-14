import { z } from "zod";

const categoryNameSchema = z
  .string()
  .trim()
  .min(1, "Ingresá el nombre de la categoría.")
  .max(80, "El nombre de la categoría no puede superar los 80 caracteres.");

export const productCategoryIdSchema = z.uuid("La categoría no es válida.");

export const createProductCategorySchema = z
  .object({ name: categoryNameSchema })
  .strict();

export const updateProductCategorySchema = z
  .object({
    name: categoryNameSchema.optional(),
    isActive: z
      .literal(true, {
        error: "Para desactivar una categoría, usá la acción correspondiente.",
      })
      .optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Indicá al menos un cambio para la categoría.",
  });
