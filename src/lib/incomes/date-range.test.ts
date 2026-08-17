import { expect, it } from "vitest";
import { getBuenosAiresMonthRange } from "./date-range";

it("returns the complete Buenos Aires calendar month", () => {
  expect(getBuenosAiresMonthRange(new Date("2026-08-12T12:00:00Z"))).toEqual({ dateFrom: "2026-08-01", dateTo: "2026-08-31" });
});
