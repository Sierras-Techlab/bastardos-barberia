import { describe, expect, it } from "vitest";

import { createUserSchema, loginSchema, updateUserSchema } from "./schemas";

describe("authentication schemas", () => {
  it("normalizes valid login input", () => {
    expect(
      loginSchema.parse({ username: " Juan.Perez ", password: "secreta" }),
    ).toEqual({ username: "juan.perez", password: "secreta" });
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

  it("rejects empty updates", () => {
    expect(updateUserSchema.safeParse({}).success).toBe(false);
  });
});
