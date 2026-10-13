import { describe, expect, it, vi } from "vitest";
import type { SafeUser } from "@/lib/auth/types";
import { updateEmployeeAgreement, confirmChairRental } from "./service";
import type { ChairRentalRepository } from "./contracts";

const user = (role: "owner" | "admin"): SafeUser => ({
  id: "00000000-0000-4000-8000-000000000001", firstName: "A", lastName: "B", username: "a.b",
  role: { id: role === "owner" ? 1 : 2, name: role }, isActive: true, serviceCommissionRate: 0,
  productCommissionRate: 0, lastLoginAt: null, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
});
const agreement = { serviceCommissionEnabled: true, productCommissionEnabled: true, chairRentalEnabled: false, monthlyChairRentalAmount: null, chairRentalEffectiveFrom: null, chairRentalDueDay: null };

describe("chair rental authorization", () => {
  it("does not allow an admin to update an agreement or confirm a payment", async () => {
    const rentals = { updateAgreement: vi.fn(), confirm: vi.fn() } as unknown as ChairRentalRepository;
    expect(() => updateEmployeeAgreement(user("admin"), "00000000-0000-4000-8000-000000000002", agreement, { rentals })).toThrow(expect.objectContaining({ status: 403 }));
    expect(() => confirmChairRental(user("admin"), "00000000-0000-4000-8000-000000000002", { period: "2026-10", paymentMethodId: "00000000-0000-4000-8000-000000000003", requestId: "00000000-0000-4000-8000-000000000004" }, { rentals })).toThrow(expect.objectContaining({ status: 403 }));
    expect(rentals.updateAgreement).not.toHaveBeenCalled();
    expect(rentals.confirm).not.toHaveBeenCalled();
  });
});
