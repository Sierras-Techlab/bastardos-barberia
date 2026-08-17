import { describe, expect, it } from "vitest";

import { normalizeUsername } from "./username";

describe("normalizeUsername", () => {
  it.each([
    ["Juan", "Pérez", "juan.perez"],
    [" María ", "De la Cruz", "maria.delacruz"],
    ["Ángel-Luis", "O'Connor", "angelluis.oconnor"],
  ])("normalizes names", (firstName, lastName, expected) => {
    expect(normalizeUsername(firstName, lastName)).toBe(expected);
  });

  it("rejects an empty normalized component", () => {
    expect(() => normalizeUsername("---", "Pérez")).toThrow();
  });
});
