import { beforeEach, expect, it, vi } from "vitest";

const { getSupabaseAdmin } = vi.hoisted(() => ({ getSupabaseAdmin: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin }));

import { fixedCustomerRepository } from "./repository";

const actorId = "00000000-0000-4000-8000-000000000003";
const occurrence = {
  id: "30000000-0000-4000-8000-000000000001",
  customer: { id: "10000000-0000-4000-8000-000000000001", firstName: "Ana", lastName: "Pérez" },
  date: "2026-08-13",
  time: "10:00",
  status: "pending" as const,
};
beforeEach(() => vi.clearAllMocks());

it("lists and resolves occurrences through exact safe RPC contracts", async () => {
  const rpc = vi.fn()
    .mockResolvedValueOnce({ data: [occurrence], error: null })
    .mockResolvedValueOnce({ data: { ...occurrence, status: "attended" }, error: null });
  getSupabaseAdmin.mockReturnValue({ rpc });
  await fixedCustomerRepository.list(actorId, { dateFrom: "2026-08-13", dateTo: "2026-08-20", status: "pending" });
  await fixedCustomerRepository.resolve(actorId, occurrence.id, { status: "attended", expectedStatus: "pending" });
  expect(rpc).toHaveBeenNthCalledWith(1, "list_fixed_customer_occurrences", { actor_user_id: actorId, date_from: "2026-08-13", date_to: "2026-08-20", filter_status: "pending" });
  expect(rpc).toHaveBeenNthCalledWith(2, "resolve_fixed_customer_occurrence", { actor_user_id: actorId, target_occurrence_id: occurrence.id, new_status: "attended", expected_status: "pending" });
});

it("maps a concurrent second resolution to conflict", async () => {
  getSupabaseAdmin.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "FIXED_OCCURRENCE_ALREADY_RESOLVED" } }) });
  await expect(fixedCustomerRepository.resolve(actorId, occurrence.id, { status: "missed", expectedStatus: "pending" }))
    .rejects.toMatchObject({ code: "FIXED_OCCURRENCE_ALREADY_RESOLVED", status: 409 });
});
