import { z } from "zod";
import type { ManagerPaymentInput, EmployeePaymentInput } from "@/types/payment-method";
import type { FixedCustomerMonthQuery } from "@/types/fixed-customer-payment";

const periodSchema = z.string().regex(
  /^(\d{4})-(0[1-9]|1[0-2])$/,
  "Ingresá un período válido (YYYY-MM).",
);

const managerPaymentSchema = z.object({
  paymentMethodId: z.uuid("Seleccioná un medio de pago válido."),
  amount: z.number().int().positive("Ingresá un monto positivo."),
}).strict();
const employeePaymentSchema = z.object({
  paymentMethodId: z.uuid("Seleccioná un medio de pago válido."),
  basisPoints: z.number().int().min(0).max(10000, "Los porcentajes van de 0 a 10000."),
}).strict();

export const payFixedCustomerMonthSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("manager"),
    requestId: z.uuid("Identificador de petición inválido."),
    customerId: z.uuid("Cliente inválido."),
    period: periodSchema,
    payments: z.array(managerPaymentSchema).min(1, "Agregá al menos un medio de pago.").superRefine((payments, context) => {
      const ids = new Set<string>();
      payments.forEach((payment, index) => {
        if (ids.has(payment.paymentMethodId)) {
          context.addIssue({ code: "custom", message: "Cada medio de pago puede aparecer una sola vez.", path: [index, "paymentMethodId"] });
        }
        ids.add(payment.paymentMethodId);
      });
    }),
  }).strict().transform((value): { requestId: string; customerId: string; period: string; payments: ManagerPaymentInput[] } => ({
    requestId: value.requestId,
    customerId: value.customerId,
    period: value.period,
    payments: value.payments.map((payment) => ({ paymentMethodId: payment.paymentMethodId, amount: payment.amount })),
  })),
  z.object({
    mode: z.literal("employee"),
    requestId: z.uuid("Identificador de petición inválido."),
    customerId: z.uuid("Cliente inválido."),
    period: periodSchema,
    payments: z.array(employeePaymentSchema).min(1, "Agregá al menos un medio de pago.").superRefine((payments, context) => {
      const ids = new Set<string>();
      const total = payments.reduce((sum, payment) => sum + payment.basisPoints, 0);
      payments.forEach((payment, index) => {
        if (ids.has(payment.paymentMethodId)) {
          context.addIssue({ code: "custom", message: "Cada medio de pago puede aparecer una sola vez.", path: [index, "paymentMethodId"] });
        }
        ids.add(payment.paymentMethodId);
      });
      if (total !== 10000) {
        context.addIssue({ code: "custom", message: "Los porcentajes deben sumar 100%." });
      }
    }),
  }).strict().transform((value): { requestId: string; customerId: string; period: string; payments: EmployeePaymentInput[] } => ({
    requestId: value.requestId,
    customerId: value.customerId,
    period: value.period,
    payments: value.payments.map((payment) => ({ paymentMethodId: payment.paymentMethodId, basisPoints: payment.basisPoints })),
  })),
]);

export const fixedCustomerMonthQuerySchema = z.object({
  period: periodSchema,
  employeeId: z.uuid().optional(),
}).strict() satisfies z.ZodType<FixedCustomerMonthQuery>;

export const fixedCustomerMonthIdentitySchema = z.object({
  id: z.uuid(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
}).strict();

export const employeeFixedCustomerMonthSchema = z.object({
  viewer: z.literal("employee"),
  customer: fixedCustomerMonthIdentitySchema,
  responsibleProfessional: fixedCustomerMonthIdentitySchema,
  period: periodSchema,
  status: z.enum(["pending", "paid"]),
  paidAt: z.iso.datetime({ offset: true }).nullable(),
  incomeId: z.uuid().nullable(),
  employeeEarning: z.number().int().nonnegative(),
}).strict().refine((value) => !("monthlyPrice" in value) || value.monthlyPrice === undefined, {
  message: "El empleado no debe recibir el precio mensual.",
});

export const managerFixedCustomerMonthSchema = z.object({
  viewer: z.literal("manager"),
  customer: fixedCustomerMonthIdentitySchema,
  responsibleProfessional: fixedCustomerMonthIdentitySchema,
  period: periodSchema,
  status: z.enum(["pending", "paid"]),
  paidAt: z.iso.datetime({ offset: true }).nullable(),
  incomeId: z.uuid().nullable(),
  employeeEarning: z.number().int().nonnegative(),
  monthlyPrice: z.number().int().positive(),
}).strict();

export const fixedCustomerMonthSchema = z.union([
  employeeFixedCustomerMonthSchema,
  managerFixedCustomerMonthSchema,
]);

export const fixedCustomerMonthsSchema = z.array(fixedCustomerMonthSchema);

export type PayFixedCustomerMonthValues = z.infer<typeof payFixedCustomerMonthSchema>;