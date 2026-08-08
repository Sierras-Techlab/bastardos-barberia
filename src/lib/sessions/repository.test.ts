import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSupabaseAdmin } = vi.hoisted(() => ({
  getSupabaseAdmin: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin }));

import { sessionRepository } from "./repository";

describe("session repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("excludes sessions that belong to logically deleted users", async () => {
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      is: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.is.mockReturnValue(query);
    getSupabaseAdmin.mockReturnValue({ from: vi.fn().mockReturnValue(query) });

    await sessionRepository.findByTokenHash("token-hash");

    expect(query.is).toHaveBeenCalledWith("user.deleted_at", null);
  });
});
