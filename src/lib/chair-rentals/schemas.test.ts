import { describe, expect, it } from "vitest";
import { employeeCommercialAgreementSchema, confirmChairRentalSchema, voidChairRentalSchema } from "./schemas";

describe("chair rental contracts", () => {
  it("requires the complete rental configuration when enabled", () => {
    expect(() => employeeCommercialAgreementSchema.parse({
      serviceCommissionEnabled: true, productCommissionEnabled: false, chairRentalEnabled: true,
      monthlyChairRentalAmount: null, chairRentalEffectiveFrom: null, chairRentalDueDay: null,
    })).toThrow();
  });
  it("clears rental configuration when disabled", () => {
    expect(employeeCommercialAgreementSchema.parse({
      serviceCommissionEnabled: true, productCommissionEnabled: true, chairRentalEnabled: false,
      monthlyChairRentalAmount: null, chairRentalEffectiveFrom: null, chairRentalDueDay: null,
    }).chairRentalEnabled).toBe(false);
  });
  it("validates idempotent confirmation and non-empty void reasons", () => {
    expect(() => confirmChairRentalSchema.parse({ period: "2026-10", paymentMethodId: "bad", requestId: "bad" })).toThrow();
    expect(() => voidChairRentalSchema.parse({ reason: "   " })).toThrow();
  });
});
