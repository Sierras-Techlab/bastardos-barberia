import { expect, it } from "vitest";
import type { IncomeListFilters } from "@/types/income";
import { toRoleSafeIncomeQuery } from "./income-view-query";

const filters: IncomeListFilters = { query: "", dateFrom: "2026-08-01", dateTo: "2026-08-31", employeeId: "00000000-0000-4000-8000-000000000002", paymentMethod: "all", kind: "all" };

it("never sends a browser employee filter for employee users", () => {
  expect(toRoleSafeIncomeQuery(filters, "employee", 1, 10)).not.toHaveProperty("userId");
});

it("allows managers to filter one employee or all", () => {
  expect(toRoleSafeIncomeQuery(filters, "owner", 1, 10)).toMatchObject({ userId: filters.employeeId });
  expect(toRoleSafeIncomeQuery({ ...filters, employeeId: "" }, "admin", 1, 10)).not.toHaveProperty("userId");
});
