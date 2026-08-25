import { describe, expect, it } from "vitest";
import { createExpenseSchema, expenseListQuerySchema, updateExpenseSchema, voidExpenseSchema } from "@/lib/expenses/schemas";

describe("expense schemas", () => {
  it("accepts integer ARS and strict manager-selected dates", () => {
    expect(createExpenseSchema.parse({ requestId: "00000000-0000-4000-8000-000000000001", accountingDate: "2026-08-23", categoryId: "10000000-0000-4000-8000-000000000001", amount: 1500, concept: "Luz", notes: "  " })).toMatchObject({ amount: 1500, concept: "Luz", notes: null });
    expect(() => createExpenseSchema.parse({ requestId: "00000000-0000-4000-8000-000000000001", accountingDate: "2026-08-23", categoryId: "10000000-0000-4000-8000-000000000001", amount: 1.5, concept: "Luz", extra: true })).toThrow();
  });
  it("requires optimistic versions and a real update", () => {
    expect(() => updateExpenseSchema.parse({ expectedUpdatedAt: "2026-08-23T12:00:00+00:00", reason: "correccion" })).toThrow();
    expect(updateExpenseSchema.parse({ expectedUpdatedAt: "2026-08-23T12:00:00+00:00", reason: "correccion", notes: " " }).notes).toBeNull();
  });
  it("rejects combining month and date-range filters", () => {
    expect(() => expenseListQuerySchema.parse({ month: "2026-08", dateFrom: "2026-08-01" })).toThrow();
  });
  it("requires the visible optimistic version when voiding", () => {
    expect(() => voidExpenseSchema.parse({ reason: "duplicado" })).toThrow();
    expect(voidExpenseSchema.parse({ expectedUpdatedAt: "2026-08-23T12:00:00+00:00", reason: "duplicado" })).toMatchObject({ reason: "duplicado" });
  });
});
