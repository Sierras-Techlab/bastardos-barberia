import { describe, expect, it } from "vitest";

import { getBuenosAiresToday } from "@/lib/cash/date";

describe("getBuenosAiresToday", () => {
  it("keeps the previous local date before Buenos Aires midnight", () => {
    expect(getBuenosAiresToday(new Date("2026-08-15T02:59:59.000Z"))).toBe(
      "2026-08-14",
    );
  });

  it("rotates at Buenos Aires midnight", () => {
    expect(getBuenosAiresToday(new Date("2026-08-15T03:00:00.000Z"))).toBe(
      "2026-08-15",
    );
  });
});
