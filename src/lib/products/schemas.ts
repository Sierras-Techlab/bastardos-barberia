import { z } from "zod";

export const productIdSchema = z.uuid("El producto no es válido.");
export const productCategoryIdSchema = z.uuid("La categoría no es válida.");

export const createProductSchema = z
  .object({
    name: z.string().trim().min(1, "Ingresá el nombre del producto."),
    categoryId: productCategoryIdSchema,
    price: z
      .number({ error: "Ingresá un precio válido." })
      .int("Ingresá un precio válido.")
      .nonnegative("Ingresá un precio válido."),
    stock: z
      .number({ error: "Ingresá un stock válido." })
      .int("Ingresá un stock válido.")
      .nonnegative("Ingresá un stock válido."),
  })
  .strict();

export const updateProductSchema = z
  .object({
    name: z.string().trim().min(1, "Ingresá el nombre del producto.").optional(),
    categoryId: productCategoryIdSchema.optional(),
    price: z
      .number({ error: "Ingresá un precio válido." })
      .int("Ingresá un precio válido.")
      .nonnegative("Ingresá un precio válido.")
      .optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Indicá al menos un cambio para el producto.",
  });

export const stockAdjustmentSchema = z
  .object({
    kind: z.enum(["entry", "exit"]),
    quantity: z
      .number({ error: "Ingresá una cantidad mayor a cero." })
      .int("Ingresá una cantidad mayor a cero.")
      .positive("Ingresá una cantidad mayor a cero."),
  })
  .strict();
