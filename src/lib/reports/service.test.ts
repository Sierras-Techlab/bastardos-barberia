import { describe, expect, it, vi } from "vitest";

import type { SafeUser } from "@/lib/auth/types";
import { getBusinessReport } from "./service";

const user = (role: "owner" | "admin" | "employee"): SafeUser => ({
  id: "00000000-0000-4000-8000-000000000001",
  firstName: "Ana", lastName: "B", username: "ana.b",
  role: { id: role === "owner" ? 1 : role === "admin" ? 2 : 3, name: role },
  isActive: true, serviceCommissionRate: 0, productCommissionRate: 0,
  lastLoginAt: null, createdAt: "2026-08-01T00:00:00Z", updatedAt: "2026-08-01T00:00:00Z",
});

describe("report service", () => {
  it("rejects employees before repository access", () => {
    const reports = { get: vi.fn() };
    expect(() => getBusinessReport(user("employee"), "2026-08", { reports })).toThrowError(
      expect.objectContaining({ code: "FORBIDDEN", status: 403 }),
    );
    expect(reports.get).not.toHaveBeenCalled();
  });

  it.each(["owner", "admin"] as const)("delegates authenticated %s identity", async (role) => {
    const reports = { get: vi.fn().mockResolvedValue({ month: "2026-08" }) };
    await getBusinessReport(user(role), "2026-08", { reports });
    expect(reports.get).toHaveBeenCalledWith(user(role).id, "2026-08");
  });
});
