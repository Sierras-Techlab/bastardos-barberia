import { expect, it } from "vitest";
import type { IncomeListItem } from "@/types/income";
import { getIncomeCommissionState, getIncomePaymentLabel } from "./income-presentation";

const base = { paymentMethod: "cash" as const } as IncomeListItem;

it("labels simple and combined payments", () => {
  expect(getIncomePaymentLabel(base)).toBe("Efectivo");
  expect(getIncomePaymentLabel({ ...base, payments: [{ method: "cash", amount: 5000 }, { method: "transfer", amount: 5000 }] })).toBe("Combinado");
});

it("distinguishes an available commission from a legacy response", () => {
  expect(getIncomeCommissionState(base)).toEqual({ available: false, amount: null });
  expect(getIncomeCommissionState({ ...base, commission: { serviceBase: 10000, productBase: 0, serviceRate: 45, productRate: 0, serviceAmount: 4500, productAmount: 0, total: 4500, barbershopNet: 5500, fullServiceCommission: false } })).toEqual({ available: true, amount: 4500 });
});
