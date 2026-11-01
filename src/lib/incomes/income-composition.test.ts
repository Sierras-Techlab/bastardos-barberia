import { expect, it } from "vitest";
import { employeePaginatedIncomesSchema, managerIncomeResponseSchema, paginatedIncomesSchema } from "./contracts";
import { formatIncomeConcept } from "./income-list";

const composition = {
  sales: { grossTotal: 119500, commissionTotal: 56750, barbershopNet: 62750 },
  subscriptions: { grossTotal: 0, commissionTotal: 0, barbershopNet: 0 },
  chairRentals: { grossTotal: 16000, commissionTotal: 0, barbershopNet: 16000 },
};
const payload = {
  items: [],
  metrics: { grossTotal: 135500, commissionTotal: 56750, barbershopNet: 78750, count: 8, average: 14938, paymentTotals: [] },
  pagination: { page: 2, pageSize: 1, total: 9, totalPages: 9 },
};

it("accepts full-period composition even when the current page is empty", () => {
  const result = paginatedIncomesSchema.parse({ ...payload, metrics: { ...payload.metrics, composition } });
  expect(result.metrics).toHaveProperty("composition.chairRentals.grossTotal", 16000);
  expect(result.metrics).toHaveProperty("composition.sales.commissionTotal", 56750);
});

it("keeps old responses valid without inventing a composition", () => {
  expect(paginatedIncomesSchema.parse(payload).metrics).not.toHaveProperty("composition");
});

it.each([
  { ...composition, chairRentals: undefined },
  { ...composition, sales: { ...composition.sales, grossTotal: 100 } },
  { ...composition, chairRentals: { grossTotal: 16000, commissionTotal: 100, barbershopNet: 15900 } },
  { ...composition, sales: { grossTotal: 119500.5, commissionTotal: 56750, barbershopNet: 62750.5 } },
])("rejects incomplete or inconsistent composition %o", (invalid) => {
  expect(paginatedIncomesSchema.safeParse({ ...payload, metrics: { ...payload.metrics, composition: invalid } }).success).toBe(false);
});

it("never accepts administrative composition in employee metrics", () => {
  const employee = { ...payload, metrics: { count: 8, employeeCommissionTotal: 56750 } };
  expect(employeePaginatedIncomesSchema.safeParse(employee).success).toBe(true);
  expect(employeePaginatedIncomesSchema.safeParse({ ...employee, metrics: { ...employee.metrics, composition } }).success).toBe(false);
});

it("rejects groups that reconcile individually but disagree with the full-period total", () => {
  const invalid = { ...composition, sales: { ...composition.sales, grossTotal: 120500, barbershopNet: 63750 } };
  expect(paginatedIncomesSchema.safeParse({ ...payload, metrics: { ...payload.metrics, composition: invalid } }).success).toBe(false);
});

it("parses and labels a monthly payment with no product or service items", () => {
  const person = { id: "00000000-0000-4000-8000-000000000001", firstName: "Milton", lastName: "Ejemplo" };
  const row = managerIncomeResponseSchema.parse({
    id: "00000000-0000-4000-8000-000000000002", createdAt: "2026-10-13T12:00:00Z", businessDate: "2026-10-13", employee: person, registeredBy: person, customer: null,
    sourceType: "fixed_subscription", subscription: { sourceType: "fixed_subscription", period: "2026-10", label: "2026-10", monthlyPrice: 12000, employeeEarning: 6000, barbershopNet: 6000 },
    service: null, products: [], payments: [], total: 12000, grossTotal: 12000, status: "active", commission: { total: 6000, barbershopNet: 6000 },
  });
  expect(formatIncomeConcept({ ...row, service: null, products: [] })).toBe("Mensualidad · octubre de 2026");
});
