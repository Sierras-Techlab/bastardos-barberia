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
  payments: [{ paymentMethodId: "60000000-0000-4000-8000-000000000003", methodName: "Crédito histórico", amount: 10000 }],
  commission: { total: 4500, barbershopNet: 5500 },
  total: 10000,
  status: "active",
};

it("labels simple and combined payments", () => {
  expect(getIncomePaymentLabel(base)).toBe("Crédito histórico");
  expect(getIncomePaymentLabel({ ...base, payments: [
    { paymentMethodId: "60000000-0000-4000-8000-000000000001", methodName: "Efectivo", amount: 4000 },
    { paymentMethodId: "60000000-0000-4000-8000-000000000002", methodName: "Transferencia", amount: 3000 },
    { paymentMethodId: "60000000-0000-4000-8000-000000000003", methodName: "Crédito histórico", amount: 3000 },
  ] })).toBe("Combinado (3 medios)");
});

it("returns the canonical commission amount", () => {
  expect(getIncomeCommissionAmount(base)).toBe(4500);
});
