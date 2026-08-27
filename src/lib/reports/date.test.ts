import { expect, it } from "vitest";

import { getBuenosAiresReportMonth } from "./date";

it("derives the report month in Buenos Aires rather than UTC", () => {
  expect(getBuenosAiresReportMonth(new Date("2026-09-01T01:00:00Z"))).toBe("2026-08");
  expect(getBuenosAiresReportMonth(new Date("2026-09-01T03:00:00Z"))).toBe("2026-09");
});
