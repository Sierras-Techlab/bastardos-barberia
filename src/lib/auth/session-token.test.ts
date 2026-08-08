import { describe, expect, it } from "vitest";

import { generateSessionToken, hashSessionToken } from "./session-token";

describe("session tokens", () => {
  it("generates distinct URL-safe tokens and deterministic hashes", () => {
    const first = generateSessionToken();
    const second = generateSessionToken();

    expect(first).not.toBe(second);
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hashSessionToken(first)).toBe(hashSessionToken(first));
    expect(hashSessionToken(first)).toMatch(/^[a-f0-9]{64}$/);
  });
});
