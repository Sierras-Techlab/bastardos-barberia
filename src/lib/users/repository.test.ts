import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSupabaseAdmin } = vi.hoisted(() => ({
  getSupabaseAdmin: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin }));

import {
  toCredentialUser,
  toSafeUser,
  userMutationFailure,
  userRepository,
} from "./repository";
import type { UserWithRoleRow } from "@/lib/supabase/database.types";

const row = {
  id: "00000000-0000-4000-8000-000000000001",
  first_name: "Juan",
  last_name: "Pérez",
  username: "juan.perez",
  password_hash: "$argon2id$v=19$hash",
  role_id: 1,
  role: { id: 1, name: "owner" },
  is_active: true,
  failed_login_attempts: 0,
  locked_until: null,
  last_login_at: null,
  password_changed_at: "2026-08-07T00:00:00.000Z",
  created_by: null,
  deleted_at: null,
  deleted_by: null,
  created_at: "2026-08-07T00:00:00.000Z",
  updated_at: "2026-08-07T00:00:00.000Z",
} satisfies UserWithRoleRow;

describe("user repository mappers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps a row to a safe camel-case user", () => {
    expect(toSafeUser(row)).toEqual({
      id: row.id,
      firstName: "Juan",
      lastName: "Pérez",
      username: "juan.perez",
      role: { id: 1, name: "owner" },
      isActive: true,
      lastLoginAt: null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  });

  it("maps authoritative username normalization failures to a safe 400", () => {
    expect(() => userMutationFailure("create user", {
      code: "22023",
      message: "INVALID_USERNAME_COMPONENT",
    })).toThrowError(expect.objectContaining({
      code: "INVALID_USERNAME_COMPONENT",
      status: 400,
    }));
  });

  it("maps authoritative self-deletion failures to a safe conflict", () => {
    expect(() => userMutationFailure("delete user", {
      code: "P0001",
      message: "CANNOT_DELETE_SELF",
    })).toThrowError(expect.objectContaining({
      code: "CANNOT_DELETE_SELF",
      status: 409,
    }));
  });

  it("adds credential state only to the internal mapper", () => {
    expect(toCredentialUser(row)).toMatchObject({
      passwordHash: row.password_hash,
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
    expect(toSafeUser(row)).not.toHaveProperty("passwordHash");
  });

  it("excludes logically deleted accounts from credential lookup", async () => {
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

    await userRepository.findCredentialsByUsername("juan.perez");

    expect(query.is).toHaveBeenCalledWith("deleted_at", null);
  });

  it("excludes logically deleted accounts from detail lookup", async () => {
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

    await userRepository.findById(row.id);

    expect(query.is).toHaveBeenCalledWith("deleted_at", null);
  });

  it("excludes logically deleted accounts from paginated lists", async () => {
    const query = {
      data: [],
      error: null,
      count: 0,
      select: vi.fn(),
      is: vi.fn(),
      order: vi.fn(),
      range: vi.fn(),
    };
    query.select.mockReturnValue(query);
    query.is.mockReturnValue(query);
    query.order.mockReturnValue(query);
    query.range.mockReturnValue(query);
    getSupabaseAdmin.mockReturnValue({ from: vi.fn().mockReturnValue(query) });

    await userRepository.list({
      page: 1,
      pageSize: 20,
      status: "all",
    });

    expect(query.is).toHaveBeenCalledWith("deleted_at", null);
  });

  it("counts only active owners that have not been deleted", async () => {
    const query = {
      count: 1,
      error: null,
      select: vi.fn(),
      eq: vi.fn(),
      is: vi.fn(),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.is.mockReturnValue(query);
    getSupabaseAdmin.mockReturnValue({ from: vi.fn().mockReturnValue(query) });

    await expect(userRepository.countActiveOwners()).resolves.toBe(1);

    expect(query.is).toHaveBeenCalledWith("deleted_at", null);
  });

  it("does not update credentials after an account is logically deleted", async () => {
    const query = {
      update: vi.fn(),
      eq: vi.fn(),
      is: vi.fn(),
      select: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    query.update.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.is.mockReturnValue(query);
    query.select.mockReturnValue(query);
    getSupabaseAdmin.mockReturnValue({ from: vi.fn().mockReturnValue(query) });

    await expect(userRepository.update(row.id, {
      passwordHash: "$argon2id$v=19$new-hash",
      passwordChangedAt: "2026-08-08T12:00:00.000Z",
    })).resolves.toBeNull();

    expect(query.is).toHaveBeenCalledWith("deleted_at", null);
  });

  it("calls the atomic logical-deletion RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: "00000000-0000-4000-8000-000000000002",
      error: null,
    });
    getSupabaseAdmin.mockReturnValue({ rpc });

    await expect(userRepository.softDelete(
      "00000000-0000-4000-8000-000000000002",
      row.id,
      "2026-08-08T12:00:00.000Z",
    )).resolves.toBe("00000000-0000-4000-8000-000000000002");

    expect(rpc).toHaveBeenCalledWith("soft_delete_user", {
      target_user_id: "00000000-0000-4000-8000-000000000002",
      actor_user_id: row.id,
      deletion_time: "2026-08-08T12:00:00.000Z",
    });
  });
});
