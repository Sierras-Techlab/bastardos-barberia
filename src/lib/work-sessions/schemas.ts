import { z } from "zod";

const integer = z.number().int();
const nonnegativeInteger = integer.nonnegative();
const timestampSchema = z.iso.datetime({ offset: true });

export const workSessionIdSchema = z.uuid("La jornada no es válida.");

const workSessionEmployeeSchema = z
  .object({
    id: z.uuid(),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
  })
  .strict();

const workSessionMetricsSchema = z
  .object({
    workedMinutes: nonnegativeInteger,
    saleCount: nonnegativeInteger,
    employeeCommission: nonnegativeInteger,
  })
  .strict();

const managerWorkSessionMetricsSchema = workSessionMetricsSchema.extend({
  grossTotal: nonnegativeInteger,
  barbershopNet: nonnegativeInteger,
}).strict();

const workSessionBaseSchema = z
  .object({
    id: workSessionIdSchema,
    employee: workSessionEmployeeSchema,
    businessDate: z.iso.date(),
    startedAt: timestampSchema,
    endedAt: timestampSchema.nullable(),
    state: z.enum(["open", "closed"]),
  })
  .strict();

const requireConsistentLifecycle = (
  session: { state: "open" | "closed"; endedAt: string | null },
  context: z.RefinementCtx,
) => {
  const lifecycleIsValid =
    (session.state === "open" && session.endedAt === null) ||
    (session.state === "closed" && session.endedAt !== null);

  if (!lifecycleIsValid) {
    context.addIssue({
      code: "custom",
      message: "El estado de la jornada no coincide con su horario de salida.",
      path: ["endedAt"],
    });
  }
};

export const employeeWorkSessionSchema = workSessionBaseSchema
  .extend({ metrics: workSessionMetricsSchema })
  .strict()
  .superRefine(requireConsistentLifecycle);

export const managerWorkSessionSchema = workSessionBaseSchema
  .extend({ metrics: managerWorkSessionMetricsSchema })
  .strict()
  .superRefine(requireConsistentLifecycle);

export const workSessionSchema = z.union([
  managerWorkSessionSchema,
  employeeWorkSessionSchema,
]);

export const workSessionCorrectionInputSchema = z
  .object({
    startedAt: timestampSchema,
    endedAt: timestampSchema.nullable(),
    reason: z.string().trim().min(1, "Indicá el motivo de la corrección."),
  })
  .strict()
  .refine(
    ({ startedAt, endedAt }) =>
      endedAt === null || Date.parse(endedAt) > Date.parse(startedAt),
    {
      message: "La salida corregida debe ser posterior a la entrada.",
      path: ["endedAt"],
    },
  );

export const workSessionListQuerySchema = z
  .object({
    employeeId: z.uuid().optional(),
    dateFrom: z.iso.date().optional(),
    dateTo: z.iso.date().optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(12),
  })
  .strict()
  .refine(
    ({ dateFrom, dateTo }) => !dateFrom || !dateTo || dateFrom <= dateTo,
    { message: "El rango de jornadas no es válido." },
  );

const workSessionPaginationSchema = z
  .object({
    page: nonnegativeInteger.positive(),
    pageSize: nonnegativeInteger.positive(),
    total: nonnegativeInteger,
    totalPages: nonnegativeInteger,
  })
  .strict();

export const paginatedEmployeeWorkSessionsSchema = z
  .object({
    items: z.array(employeeWorkSessionSchema),
    pagination: workSessionPaginationSchema,
  })
  .strict();

export const paginatedManagerWorkSessionsSchema = z
  .object({
    items: z.array(managerWorkSessionSchema),
    pagination: workSessionPaginationSchema,
  })
  .strict();

export const paginatedWorkSessionsSchema = z.union([
  paginatedManagerWorkSessionsSchema,
  paginatedEmployeeWorkSessionsSchema,
]);
