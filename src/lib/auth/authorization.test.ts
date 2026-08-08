import { describe, expect, it } from "vitest";

import { assertManager } from "./authorization";
import type { SafeUser } from "./types";

const user = (name: "owner" | "admin" | "employee") => ({
  id: "user-id", firstName: "Ana", lastName: "García", username: "ana.garcia",
  role: { id: name === "owner" ? 1 : name === "admin" ? 2 : 3, name }, isActive: true,
  lastLoginAt: null, createdAt: "2026-08-07T00:00:00.000Z", updatedAt: "2026-08-07T00:00:00.000Z",
}) as SafeUser;

describe("assertManager", () => {
  it.each(["owner", "admin"] as const)("accepts %s", (role) => {
    expect(assertManager(user(role))).toEqual(user(role));
  });

  it("rejects employees", () => {
    expect(() => assertManager(user("employee"))).toThrowError(expect.objectContaining({ code: "FORBIDDEN" }));
  });
});
