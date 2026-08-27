import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireManager, getBusinessReport } = vi.hoisted(() => ({
  requireManager: vi.fn(),
  getBusinessReport: vi.fn(),
}));
vi.mock("@/lib/auth/authorization", () => ({ requireManager }));
vi.mock("@/lib/reports/service", () => ({ getBusinessReport }));

import { AppError } from "@/lib/auth/errors";
import { GET } from "./route";

describe("GET /api/reports/business", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireManager.mockResolvedValue({ user: { id: "manager" } });
    getBusinessReport.mockResolvedValue({ month: "2026-08" });
  });

  it("authorizes before validating the month", async () => {
    const response = await GET(new Request("http://localhost/api/reports/business?month=invalid"));
    expect(response.status).toBe(400);
    expect(requireManager).toHaveBeenCalledOnce();
    expect(getBusinessReport).not.toHaveBeenCalled();
  });

  it("uses only authenticated manager identity", async () => {
    const response = await GET(new Request("http://localhost/api/reports/business?month=2026-08&actorId=employee"));
    expect(response.status).toBe(400);
    expect(getBusinessReport).not.toHaveBeenCalled();

    const success = await GET(new Request("http://localhost/api/reports/business?month=2026-08"));
    expect(success.status).toBe(200);
    expect(getBusinessReport).toHaveBeenCalledWith({ id: "manager" }, "2026-08");
  });

  it.each([
    [new AppError("UNAUTHENTICATED", "Debés iniciar sesión.", 401), 401],
    [new AppError("FORBIDDEN", "No tenés permisos.", 403), 403],
  ])("preserves authorization failures", async (error, status) => {
    requireManager.mockRejectedValue(error);
    expect((await GET(new Request("http://localhost/api/reports/business?month=2026-08"))).status).toBe(status);
  });
});
