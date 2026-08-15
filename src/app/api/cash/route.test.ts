import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireManager, getCashDay, getBuenosAiresToday } = vi.hoisted(() => ({
  requireManager: vi.fn(),
  getCashDay: vi.fn(),
  getBuenosAiresToday: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({ requireManager }));
vi.mock("@/lib/cash/service", () => ({ getCashDay }));
vi.mock("@/lib/cash/date", () => ({ getBuenosAiresToday }));

import { GET } from "./route";

const actor = { id: "00000000-0000-4000-8000-000000000001" };

describe("GET /api/cash", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireManager.mockResolvedValue({ user: actor });
    getBuenosAiresToday.mockReturnValue("2026-08-15");
    getCashDay.mockResolvedValue({ businessDate: "2026-08-15" });
  });

  it("authorizes before resolving the requested business date", async () => {
    const response = await GET(
      new Request("http://localhost/api/cash?date=2026-08-14"),
    );

    expect(response.status).toBe(200);
    expect(requireManager.mock.invocationCallOrder[0]).toBeLessThan(
      getCashDay.mock.invocationCallOrder[0],
    );
    expect(getCashDay).toHaveBeenCalledWith(actor, "2026-08-14");
  });

  it("defaults to the Buenos Aires date and validates explicit input", async () => {
    await GET(new Request("http://localhost/api/cash"));
    expect(getCashDay).toHaveBeenCalledWith(actor, "2026-08-15");

    const response = await GET(
      new Request("http://localhost/api/cash?date=not-a-date"),
    );
    expect(response.status).toBe(400);
    expect(requireManager).toHaveBeenCalledTimes(2);
    expect(getCashDay).toHaveBeenCalledTimes(1);
  });
});

