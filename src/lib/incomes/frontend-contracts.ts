import { z } from "zod";

export const incomePaymentSchema = z.object({
  method: z.enum(["cash", "transfer"]),
  amount: z.number().int().positive(),
}).strict();

export const createIncomeV2InputSchema = z.object({
  requestId: z.uuid(),
  employeeId: z.uuid(),
  customerId: z.uuid().nullable(),
  serviceId: z.uuid().nullable(),
  products: z.array(z.object({ productId: z.uuid(), quantity: z.number().int().positive() }).strict()),
  payments: z.array(incomePaymentSchema).min(1).max(2),
  grantFullServiceCommission: z.boolean(),
}).strict();
