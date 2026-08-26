import { z } from "zod";

const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "El mes no es válido.");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha no es válida.");
const timestamp = z.iso.datetime({ offset: true });
const signedMoney = z.number().int().safe();
const nonnegativeMoney = signedMoney.nonnegative();

export const reportMonthQuerySchema = z.object({ month }).strict();

export const reportMetricsSchema = z.object({
  grossIncome: nonnegativeMoney,
  commission: nonnegativeMoney,
  barbershopNet: signedMoney,
  expenses: nonnegativeMoney,
  operatingResult: signedMoney,
  operatingMarginBps: z.number().int().safe().nullable(),
}).strict();

const dailyMetricsSchema = z.object({
  grossIncome: nonnegativeMoney,
  expenses: nonnegativeMoney,
  operatingResult: signedMoney,
}).strict();

const incomeBreakdownSchema = z.object({
  key: z.enum(["services", "products", "subscriptions"]),
  amount: nonnegativeMoney,
}).strict();

const expenseBreakdownSchema = z.object({
  key: z.enum(["fixed", "variable", "supplies"]),
  amount: nonnegativeMoney,
}).strict();

const namedBreakdownSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  amount: nonnegativeMoney,
}).strict();

const rankedItemSchema = namedBreakdownSchema.extend({
  quantity: z.number().int().safe().nonnegative(),
}).strict();

const dayHighlightSchema = z.object({
  date,
  amount: signedMoney,
}).strict();

export const businessReportSchema = z.object({
  month,
  availableMonths: z.array(month).min(1).superRefine((months, context) => {
    if (new Set(months).size !== months.length) {
      context.addIssue({ code: "custom", message: "Los meses disponibles no pueden repetirse." });
    }
  }),
  generatedAt: timestamp,
  period: z.object({
    from: date,
    to: date,
    elapsedDays: z.number().int().min(1).max(31),
    daysInMonth: z.number().int().min(28).max(31),
    isCurrentMonth: z.boolean(),
  }).strict(),
  comparison: z.object({
    month,
    from: date,
    to: date,
  }).strict(),
  summary: reportMetricsSchema,
  previousSummary: reportMetricsSchema,
  projection: reportMetricsSchema.nullable(),
  daily: z.array(z.object({
    day: z.number().int().min(1).max(31),
    selected: dailyMetricsSchema,
    previous: dailyMetricsSchema.nullable(),
  }).strict()),
  incomeComposition: z.array(incomeBreakdownSchema),
  paymentComposition: z.array(namedBreakdownSchema),
  expenseComposition: z.array(expenseBreakdownSchema),
  serviceRanking: z.array(rankedItemSchema),
  productRanking: z.array(rankedItemSchema),
  highlights: z.object({
    bestDay: dayHighlightSchema.nullable(),
    worstDay: dayHighlightSchema.nullable(),
  }).strict(),
}).strict();
