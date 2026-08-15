import { expect, it } from "vitest";
import { fixedOccurrenceQuerySchema, resolveOccurrenceSchema } from "./schemas";

it("accepts bounded occurrence queries and strict attendance bodies", () => {
  expect(fixedOccurrenceQuerySchema.parse({
    dateFrom: "2026-08-13",
    dateTo: "2026-08-20",
    status: "pending",
  })).toEqual({ dateFrom: "2026-08-13", dateTo: "2026-08-20", status: "pending" });
  expect(resolveOccurrenceSchema.parse({ status: "attended", expectedStatus: "pending" }))
    .toEqual({ status: "attended", expectedStatus: "pending" });
});

it("rejects inverted ranges and extra mutation authority", () => {
  expect(fixedOccurrenceQuerySchema.safeParse({ dateFrom: "2026-08-20", dateTo: "2026-08-13" }).success).toBe(false);
  expect(resolveOccurrenceSchema.safeParse({
    status: "missed",
    expectedStatus: "pending",
    customerId: crypto.randomUUID(),
  }).success).toBe(false);
});
