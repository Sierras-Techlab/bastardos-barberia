import { expect, it } from "vitest";

import { commissionRatesSchema, normalizeCommissionUser } from "@/lib/users/frontend-user-contracts";

const user = { id: "u", firstName: "Fer", lastName: "B", username: "fer.b", role: { id: 3 as const, name: "employee" as const }, isActive: true, lastLoginAt: null, createdAt: "x", updatedAt: "x" };

it("defaults missing legacy commission rates to zero", () => {
  expect(normalizeCommissionUser(user)).toMatchObject({ serviceCommissionRate: 0, productCommissionRate: 0 });
});

it("accepts integer rates from zero through one hundred", () => {
  expect(commissionRatesSchema.parse({ serviceCommissionRate: 45, productCommissionRate: 10 })).toEqual({ serviceCommissionRate: 45, productCommissionRate: 10 });
  expect(() => commissionRatesSchema.parse({ serviceCommissionRate: 101, productCommissionRate: 10 })).toThrow();
  expect(() => commissionRatesSchema.parse({ serviceCommissionRate: 45.5, productCommissionRate: 10 })).toThrow();
});
