import { z } from "zod";
import { createCustomerSchema } from "@/lib/customers/schemas";
import type { CustomerEditorInput } from "@/types/customer";
import type { FixedSchedule } from "@/types/fixed-customer";

export const fixedScheduleSchema = z.object({ weekday: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6), z.literal(7)]), time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Ingresá una hora válida.") }).strict();
export const frontendCustomerEditorSchema = createCustomerSchema.extend({ fixedSchedule: fixedScheduleSchema.nullable() }).strict();
export type FrontendCustomerEditorInput = CustomerEditorInput & { fixedSchedule: FixedSchedule | null };
export const withoutEmptyFixedSchedule = (input: FrontendCustomerEditorInput) => input.fixedSchedule === null
  ? { firstName: input.firstName, lastName: input.lastName, phone: input.phone, email: input.email }
  : input;
