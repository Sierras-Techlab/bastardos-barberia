import { describe, expect, it } from "vitest";

import { getBuenosAiresRemainingWorkweekRange } from "@/lib/dashboard/workweek-range";

describe("getBuenosAiresRemainingWorkweekRange", () => {
  it.each([
    ["Monday", "2026-08-10T15:00:00.000Z", { dateFrom: "2026-08-10", dateTo: "2026-08-15" }],
    ["Thursday", "2026-08-13T15:00:00.000Z", { dateFrom: "2026-08-13", dateTo: "2026-08-15" }],
    ["Saturday", "2026-08-15T15:00:00.000Z", { dateFrom: "2026-08-15", dateTo: "2026-08-15" }],
  ])("returns the remaining range on %s", (_label, instant, expected) => {
    expect(getBuenosAiresRemainingWorkweekRange(new Date(instant))).toEqual(expected);
  });

  it("returns null on Sunday", () => {
    expect(getBuenosAiresRemainingWorkweekRange(new Date("2026-08-16T15:00:00.000Z"))).toBeNull();
  });

  it("uses the Buenos Aires date near UTC midnight", () => {
    expect(getBuenosAiresRemainingWorkweekRange(new Date("2026-08-17T01:30:00.000Z"))).toBeNull();
    expect(getBuenosAiresRemainingWorkweekRange(new Date("2026-08-17T03:30:00.000Z"))).toEqual({
      dateFrom: "2026-08-17",
      dateTo: "2026-08-22",
    });
  });
});
