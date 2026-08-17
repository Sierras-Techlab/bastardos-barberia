import { beforeEach, expect, it, vi } from "vitest";
const { requireUser, listFixedOccurrences } = vi.hoisted(() => ({ requireUser: vi.fn(), listFixedOccurrences: vi.fn() }));
vi.mock("@/lib/auth/authorization", () => ({ requireUser }));
vi.mock("@/lib/fixed-customers/service", () => ({ listFixedOccurrences }));
import { GET } from "./route";
const actor = { id: "00000000-0000-4000-8000-000000000003" };
beforeEach(() => { vi.clearAllMocks(); requireUser.mockResolvedValue({ user: actor }); listFixedOccurrences.mockResolvedValue([]); });

it("allows employees to list a bounded date range", async () => {
  const response = await GET(new Request("http://localhost/api/fixed-customer-occurrences?dateFrom=2026-08-13&dateTo=2026-08-20&status=pending"));
  expect(response.status).toBe(200);
  expect(listFixedOccurrences).toHaveBeenCalledWith(actor, { dateFrom: "2026-08-13", dateTo: "2026-08-20", status: "pending" });
});
