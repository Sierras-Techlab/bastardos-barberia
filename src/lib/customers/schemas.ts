import { z } from "zod";
import type { FixedScheduleInput } from "@/types/fixed-customer";

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
export const fixedScheduleSchema = z.object({
  weekday: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6), z.literal(7)]),
  time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Ingresá una hora válida."),
  responsibleProfessional: z.object({
    id: z.uuid(),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
  }).strict(),
  monthlyPrice: z.number().int().positive(),
}).strict();
export const fixedScheduleInputSchema = z.object({
  weekday: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6), z.literal(7)]),
  time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Ingresá una hora válida."),
  responsibleUserId: z.uuid().optional(),
  monthlyPrice: z.number().int().positive("Ingresá un precio mensual válido."),
}).strict().transform((value): FixedScheduleInput => ({
  weekday: value.weekday,
  time: value.time,
  responsibleUserId: value.responsibleUserId,
  monthlyPrice: value.monthlyPrice,
}));

const customerFieldsSchema = z.object({
  firstName: z.string().trim().min(1, "Ingresá el nombre.").max(80),
  lastName: z.string().trim().min(1, "Ingresá el apellido.").max(80),
  phone: phoneSchema,
  email: optionalEmailSchema,
});
export const createCustomerSchema = customerFieldsSchema.extend({
  fixedSchedule: fixedScheduleInputSchema.nullable().default(null),
}).strict();
export const updateCustomerSchema = z.object({
  firstName: z.string().trim().min(1, "Ingresá el nombre.").max(80).optional(),
  lastName: z.string().trim().min(1, "Ingresá el apellido.").max(80).optional(),
  phone: phoneSchema.optional(),
  email: optionalEmailSchema.optional(),
  fixedSchedule: fixedScheduleInputSchema.nullable().optional(),
  expectedScheduleVersion: z.number().int().nonnegative().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: "Indicá al menos un cambio para el cliente.",
}).refine((value) => value.fixedSchedule === undefined || value.expectedScheduleVersion !== undefined, {
  message: "La versión del horario es obligatoria.",
  path: ["expectedScheduleVersion"],
});

export const customerVisitQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
}).strict();
