import { describe, expect, it } from "vitest";

import {
  createPaymentMethodSchema,
  paymentMethodIdSchema,
  updatePaymentMethodSchema,
} from "@/lib/payment-methods/schemas";

describe("payment method boundary schemas", () => {
  it("trims names between one and eighty characters", () => {
    expect(createPaymentMethodSchema.parse({ name: "  Transferencia  " })).toEqual({
      name: "Transferencia",
    });
    expect(createPaymentMethodSchema.safeParse({ name: " " }).success).toBe(false);
    expect(createPaymentMethodSchema.safeParse({ name: "a".repeat(81) }).success).toBe(
      false,
    );
  });

  it("rejects malformed identifiers, unknown fields, empty updates and direct deactivation", () => {
    expect(paymentMethodIdSchema.safeParse("efectivo").success).toBe(false);
    expect(createPaymentMethodSchema.safeParse({ name: "Efectivo", active: true }).success)
      .toBe(false);
    expect(updatePaymentMethodSchema.safeParse({}).success).toBe(false);
    expect(updatePaymentMethodSchema.safeParse({ deletedAt: null }).success).toBe(false);
    expect(updatePaymentMethodSchema.safeParse({ isActive: false }).success).toBe(false);
    expect(updatePaymentMethodSchema.parse({ isActive: true })).toEqual({
      isActive: true,
    });
  });
});
