import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("uses Argon2id and verifies only the correct password", async () => {
    const encoded = await hashPassword("cuchilla-segura-2026");

    expect(encoded).toMatch(/^\$argon2id\$/);
    await expect(
      verifyPassword(encoded, "cuchilla-segura-2026"),
    ).resolves.toBe(true);
    await expect(verifyPassword(encoded, "incorrecta")).resolves.toBe(false);
  });
});
