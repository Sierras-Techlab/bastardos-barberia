import { describe, expect, it } from "vitest";

import { createUserSchema, loginSchema, updateUserSchema } from "./schemas";

describe("authentication schemas", () => {
  it("normalizes valid login input", () => {
    expect(
      loginSchema.parse({ username: " Juan.Perez ", password: "secreta" }),
    ).toEqual({ username: "juan.perez", password: "secreta" });
  });

  it("accepts the longest username produced by valid employee names", () => {
    const username = `${"a".repeat(80)}.${"b".repeat(80)}`;
    expect(loginSchema.safeParse({ username, password: "secreta" }).success).toBe(true);
  });

  it("requires a ten-character password when creating users", () => {
    const result = createUserSchema.safeParse({
      firstName: "Juan",
      lastName: "Pérez",
      password: "corta",
      roleId: 3,
    });

    expect(result.success).toBe(false);
  });

  it("rejects names that cannot produce a login username", () => {
    const result = createUserSchema.safeParse({
      firstName: "---",
      lastName: "!!!",
      password: "password-2026",
      roleId: 3,
    });

    expect(result.success).toBe(false);
  });

  it("does not reject Unicode letters that PostgreSQL unaccent can transliterate", () => {
    const result = createUserSchema.safeParse({
      firstName: "S\u00f8ren",
      lastName: "\u0141ukasz",
      password: "password-2026",
      roleId: 3,
    });

    expect(result.success).toBe(true);
  });

  it("rejects empty updates", () => {
    expect(updateUserSchema.safeParse({}).success).toBe(false);
  });
});
