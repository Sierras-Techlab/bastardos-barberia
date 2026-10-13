import { describe, expect, it } from "vitest";
import { createExpenseSchema, expenseListQuerySchema, expenseMonthSummarySchema, updateExpenseSchema, voidExpenseSchema } from "@/lib/expenses/schemas";

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
  it("accepts the chair-rental effective-date breakdown returned by the summary RPC", () => {
    const result = expenseMonthSummarySchema.parse({
      month: "2026-10",
      grossIncome: 360000,
      commission: 0,
      barbershopNet: 360000,
      expenses: 0,
      operatingResult: 360000,
      fixedTotal: 0,
      variableTotal: 0,
      suppliesTotal: 0,
      chairRentals: {
        total: 360000,
        count: 1,
        byEffectiveDate: [{ date: "2026-10-12", amount: 360000, count: 1 }],
        payingEmployees: [{ employeeId: "00000000-0000-4000-8000-000000000001", employeeName: "Valentin Caceres", amount: 360000, paymentCount: 1 }],
        pending: [],
        overdue: [],
      },
    });

    expect(result.chairRentals?.byEffectiveDate).toHaveLength(1);
  });
});
