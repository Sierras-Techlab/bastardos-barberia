import { describe, expect, it, vi } from "vitest";

import { bootstrapOwner, parseBootstrapOwnerEnv } from "./owner";

describe("owner bootstrap", () => {
  it("rejects missing bootstrap environment values", () => {
    expect(() => parseBootstrapOwnerEnv({})).toThrow();
  });

  it("reads and validates the dedicated environment values", () => {
    expect(parseBootstrapOwnerEnv({
      BOOTSTRAP_OWNER_FIRST_NAME: "Ada",
      BOOTSTRAP_OWNER_LAST_NAME: "Lovelace",
      BOOTSTRAP_OWNER_PASSWORD: "safe-password",
    })).toEqual({ firstName: "Ada", lastName: "Lovelace", password: "safe-password" });
  });

  it("creates the first owner with a hash and the fixed owner role", async () => {
    const dependencies = {
      countUsers: vi.fn().mockResolvedValue(0),
      createOwner: vi.fn().mockResolvedValue({ username: "ada.lovelace" }),
      hashPassword: vi.fn().mockResolvedValue("$argon2id$hash"),
    };

    const result = await bootstrapOwner(
      { firstName: "Ada", lastName: "Lovelace", password: "safe-password" },
      dependencies,
    );

    expect(dependencies.createOwner).toHaveBeenCalledWith({
      firstName: "Ada",
      lastName: "Lovelace",
      passwordHash: "$argon2id$hash",
      roleId: 1,
    });
    expect(result.username).toBe("ada.lovelace");
  });

  it("refuses to bootstrap when any user already exists", async () => {
    const dependencies = {
      countUsers: vi.fn().mockResolvedValue(1),
      createOwner: vi.fn(),
      hashPassword: vi.fn(),
    };

    await expect(bootstrapOwner(
      { firstName: "Ada", lastName: "Lovelace", password: "safe-password" },
      dependencies,
    )).rejects.toEqual(expect.objectContaining({ code: "BOOTSTRAP_ALREADY_COMPLETED" }));
    expect(dependencies.hashPassword).not.toHaveBeenCalled();
  });
});
