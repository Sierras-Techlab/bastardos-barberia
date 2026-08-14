import { expect, it } from "vitest";
import type { IncomeListItem } from "@/types/income";
import { getIncomeCommissionAmount, getIncomePaymentLabel } from "./income-presentation";

const base: IncomeListItem = {
  id: "income-1",
  createdAt: "2026-08-11T12:00:00.000Z",
  businessDate: "2026-08-11",
  employee: { id: "employee-1", firstName: "Ana", lastName: "Pérez" },
  registeredBy: { id: "employee-1", firstName: "Ana", lastName: "Pérez" },
  customer: null,
  service: null,
  products: [],
  paymentMethod: "cash",
  payments: [{ method: "cash", amount: 10000 }],
  commission: { total: 4500, barbershopNet: 5500 },
  total: 10000,
  status: "active",
};

it("labels simple and combined payments", () => {
  expect(getIncomePaymentLabel(base)).toBe("Efectivo");
  expect(getIncomePaymentLabel({ ...base, payments: [{ method: "cash", amount: 5000 }, { method: "transfer", amount: 5000 }] })).toBe("Combinado");
});

it("returns the canonical commission amount", () => {
  expect(getIncomeCommissionAmount(base)).toBe(4500);
});
