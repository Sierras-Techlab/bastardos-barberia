import { describe, expect, it } from "vitest";

import { toCredentialUser, toSafeUser, userMutationFailure } from "./repository";
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
  created_at: "2026-08-07T00:00:00.000Z",
  updated_at: "2026-08-07T00:00:00.000Z",
} satisfies UserWithRoleRow;

describe("user repository mappers", () => {
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

  it("adds credential state only to the internal mapper", () => {
    expect(toCredentialUser(row)).toMatchObject({
      passwordHash: row.password_hash,
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
    expect(toSafeUser(row)).not.toHaveProperty("passwordHash");
  });
});
