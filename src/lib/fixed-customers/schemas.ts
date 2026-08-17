import { z } from "zod";

export const fixedOccurrenceQuerySchema = z.object({
  dateFrom: z.iso.date(),
  dateTo: z.iso.date(),
  status: z.enum(["pending", "attended", "missed"]).optional(),
}).strict().refine(({ dateFrom, dateTo }) => dateFrom <= dateTo, {
  path: ["dateTo"],
}).refine(({ dateFrom, dateTo }) => (
  (Date.parse(`${dateTo}T00:00:00Z`) - Date.parse(`${dateFrom}T00:00:00Z`)) / 86_400_000 <= 70
), {
  path: ["dateTo"],
});

export const resolveOccurrenceSchema = z.object({
  status: z.enum(["attended", "missed"]),
  expectedStatus: z.literal("pending"),
}).strict();

export const occurrenceIdSchema = z.uuid();
