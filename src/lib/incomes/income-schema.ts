import { z } from "zod";

export const incomeFormSchema = z
  .object({
    employeeId: z.string().min(1, "Seleccioná un empleado responsable."),
    customerId: z.string().nullable(),
    serviceId: z.string().nullable(),
    products: z.array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive(),
      }),
    ),
    paymentMethod: z.enum(["cash", "transfer"]).nullable(),
  })
  .refine((value) => value.serviceId !== null || value.products.length > 0, {
    message: "Seleccioná un servicio o agregá al menos un producto.",
    path: ["serviceId"],
  })
  .refine((value) => value.paymentMethod !== null, {
    message: "Seleccioná un medio de pago.",
    path: ["paymentMethod"],
  });

export type IncomeFormValues = z.infer<typeof incomeFormSchema>;
