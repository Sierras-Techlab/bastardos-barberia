import { z } from "zod";
import type { FixedCustomerOccurrence, FixedOccurrenceQuery, ResolveFixedOccurrenceInput } from "@/types/fixed-customer";

const identitySchema = z.object({ id: z.uuid(), firstName: z.string().min(1), lastName: z.string() }).strict();
export const fixedCustomerOccurrenceSchema = z.object({
  id: z.uuid(),
  customer: identitySchema,
  date: z.iso.date(),
  time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  status: z.enum(["pending", "attended", "missed"]),
}).strict();
export const fixedCustomerOccurrencesSchema = z.array(fixedCustomerOccurrenceSchema);

export type FixedCustomerRepository = {
  list(actorId: string, query: FixedOccurrenceQuery): Promise<FixedCustomerOccurrence[]>;
  resolve(actorId: string, id: string, input: ResolveFixedOccurrenceInput): Promise<FixedCustomerOccurrence>;
};
export type FixedCustomerDependencies = { occurrences: FixedCustomerRepository };
