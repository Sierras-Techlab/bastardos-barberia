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

  it("loads commission rates for the authenticated user", async () => {
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

    expect(query.select).toHaveBeenCalledWith(
      expect.stringContaining("service_commission_rate"),
    );
    expect(query.select).toHaveBeenCalledWith(
      expect.stringContaining("product_commission_rate"),
    );
  });

  it("maps the activity timestamp used to throttle session writes", async () => {
    const row = {
      id: "session-id",
      user_id: "user-id",
      expires_at: "2026-08-08T00:00:00.000Z",
      revoked_at: null,
      last_seen_at: "2026-08-07T11:58:00.000Z",
      user: {
        id: "user-id",
        first_name: "Juan",
        last_name: "Pérez",
        username: "juan.perez",
        is_active: true,
        last_login_at: null,
        created_at: "2026-08-01T00:00:00.000Z",
        updated_at: "2026-08-01T00:00:00.000Z",
        role: { id: 1, name: "owner" },
      },
    };
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      is: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.is.mockReturnValue(query);
    getSupabaseAdmin.mockReturnValue({ from: vi.fn().mockReturnValue(query) });

    await expect(sessionRepository.findByTokenHash("token-hash")).resolves.toMatchObject({
      lastSeenAt: "2026-08-07T11:58:00.000Z",
    });
  });
});
