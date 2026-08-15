import { describe, expect, it } from "vitest";

import type { SafeUser } from "@/lib/auth/types";
import {
  formatLastLogin,
  getUserInitials,
  ROLE_LABELS,
  summarizeUserPage,
} from "./presentation";

const user = (isActive: boolean): SafeUser => ({
  id: isActive ? "active" : "inactive",
  firstName: "Lucía",
  lastName: "Ferreyra",
  username: "lucia.ferreyra",
  role: { id: 3, name: "employee" },
  isActive,
  serviceCommissionRate: 0,
  productCommissionRate: 0,
  lastLoginAt: null,
  createdAt: "2026-08-08T12:00:00.000Z",
  updatedAt: "2026-08-08T12:00:00.000Z",
});

describe("user presentation", () => {
  it("uses clear Spanish role labels", () => {
    expect(ROLE_LABELS).toEqual({
      owner: "Dueño",
      admin: "Administrador",
      employee: "Empleado",
    });
  });

  it("distinguishes users who never logged in", () => {
    expect(formatLastLogin(null)).toBe("Nunca");
    expect(formatLastLogin("2026-08-08T15:00:00.000Z"))
      .toBe("8 ago 2026, 12:00");
  });

  it("summarizes only the currently loaded page", () => {
    expect(summarizeUserPage([user(true), user(true), user(false)])).toEqual({
      total: 3,
      active: 2,
      inactive: 1,
    });
  });

  it("builds stable initials from both names", () => {
    expect(getUserInitials(user(true))).toBe("LF");
  });
});
