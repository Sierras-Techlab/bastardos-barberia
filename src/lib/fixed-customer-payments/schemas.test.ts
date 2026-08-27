import { describe, expect, it } from "vitest";

import {
  employeeFixedCustomerMonthSchema,
  fixedCustomerMonthQuerySchema,
  managerFixedCustomerMonthSchema,
  payFixedCustomerMonthSchema,
} from "@/lib/fixed-customer-payments/schemas";

describe("fixed customer payment schemas", () => {
  describe("fixedCustomerMonthQuerySchema", () => {
    it("accepts a strict YYYY-MM period", () => {
      const parsed = fixedCustomerMonthQuerySchema.safeParse({ period: "2026-08" });
      expect(parsed.success).toBe(true);
      expect(parsed.data).toEqual({ period: "2026-08" });
    });

    it("rejects loose, empty or out-of-range periods", () => {
      expect(fixedCustomerMonthQuerySchema.safeParse({ period: "2026-8" }).success).toBe(false);
      expect(fixedCustomerMonthQuerySchema.safeParse({ period: "26-08" }).success).toBe(false);
      expect(fixedCustomerMonthQuerySchema.safeParse({ period: "2026-13" }).success).toBe(false);
      expect(fixedCustomerMonthQuerySchema.safeParse({ period: "" }).success).toBe(false);
    });

    it("accepts an optional employeeId", () => {
      const parsed = fixedCustomerMonthQuerySchema.safeParse({
        period: "2026-08",
        employeeId: "00000000-0000-4000-8000-000000000003",
      });
      expect(parsed.success).toBe(true);
    });
  });

  describe("payFixedCustomerMonthSchema", () => {
    it("accepts a manager submission with positive amounts and distinct methods", () => {
      const parsed = payFixedCustomerMonthSchema.safeParse({
        mode: "manager",
        requestId: "00000000-0000-4000-8000-0000000000aa",
        customerId: "10000000-0000-4000-8000-000000000001",
        period: "2026-08",
        payments: [
          { paymentMethodId: "00000000-0000-4000-8000-0000000000a1", amount: 10000 },
          { paymentMethodId: "00000000-0000-4000-8000-0000000000a2", amount: 5000 },
        ],
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.payments).toEqual([
          { paymentMethodId: "00000000-0000-4000-8000-0000000000a1", amount: 10000 },
          { paymentMethodId: "00000000-0000-4000-8000-0000000000a2", amount: 5000 },
        ]);
      }
    });

    it("rejects manager payments with zero, negative or duplicated method IDs", () => {
      const base = {
        mode: "manager" as const,
        requestId: "00000000-0000-4000-8000-0000000000aa",
        customerId: "10000000-0000-4000-8000-000000000001",
        period: "2026-08",
      };
      expect(payFixedCustomerMonthSchema.safeParse({ ...base, payments: [{ paymentMethodId: "00000000-0000-4000-8000-0000000000a1", amount: 0 }] }).success).toBe(false);
      expect(payFixedCustomerMonthSchema.safeParse({ ...base, payments: [{ paymentMethodId: "00000000-0000-4000-8000-0000000000a1", amount: -1 }] }).success).toBe(false);
      expect(payFixedCustomerMonthSchema.safeParse({ ...base, payments: [
        { paymentMethodId: "00000000-0000-4000-8000-0000000000a1", amount: 5000 },
        { paymentMethodId: "00000000-0000-4000-8000-0000000000a1", amount: 5000 },
      ] }).success).toBe(false);
    });

    it("accepts an employee submission whose basis points sum to 10000", () => {
      const parsed = payFixedCustomerMonthSchema.safeParse({
        mode: "employee",
        requestId: "00000000-0000-4000-8000-0000000000aa",
        customerId: "10000000-0000-4000-8000-000000000001",
        period: "2026-08",
        payments: [
          { paymentMethodId: "00000000-0000-4000-8000-0000000000a1", basisPoints: 6000 },
          { paymentMethodId: "00000000-0000-4000-8000-0000000000a2", basisPoints: 4000 },
        ],
      });
      expect(parsed.success).toBe(true);
    });

    it("rejects an employee submission whose basis points do not sum to 10000", () => {
      const parsed = payFixedCustomerMonthSchema.safeParse({
        mode: "employee",
        requestId: "00000000-0000-4000-8000-0000000000aa",
        customerId: "10000000-0000-4000-8000-000000000001",
        period: "2026-08",
        payments: [{ paymentMethodId: "00000000-0000-4000-8000-0000000000a1", basisPoints: 9999 }],
      });
      expect(parsed.success).toBe(false);
    });
  });

  describe("viewer projection schemas", () => {
    it("rejects manager-only fields in the employee projection", () => {
      expect(employeeFixedCustomerMonthSchema.safeParse({
        viewer: "employee",
        customer: { id: "00000000-0000-4000-8000-000000000001", firstName: "A", lastName: "B" },
        responsibleProfessional: { id: "00000000-0000-4000-8000-000000000003", firstName: "F", lastName: "P" },
        period: "2026-08",
        status: "paid",
        paidAt: "2026-08-15T13:00:00.000Z",
        incomeId: "00000000-0000-4000-8000-0000000000a0",
        employeeEarning: 4500,
        monthlyPrice: 15000,
      }).success).toBe(false);
    });

    it("requires monthlyPrice in the manager projection", () => {
      const projection = {
        viewer: "manager" as const,
        customer: { id: "00000000-0000-4000-8000-000000000001", firstName: "A", lastName: "B" },
        responsibleProfessional: { id: "00000000-0000-4000-8000-000000000003", firstName: "F", lastName: "P" },
        period: "2026-08",
        status: "pending" as const,
        paidAt: null,
        incomeId: null,
        employeeEarning: 0,
      };
      expect(managerFixedCustomerMonthSchema.safeParse({ ...projection, monthlyPrice: 0 }).success).toBe(false);
      expect(managerFixedCustomerMonthSchema.safeParse({ ...projection, monthlyPrice: 15000 }).success).toBe(true);
    });
  });
});