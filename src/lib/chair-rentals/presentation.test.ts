import { describe, expect, it } from "vitest";

import {
  formatChairRentalPeriod,
  formatBuenosAiresDate,
  formatBuenosAiresDateTime,
} from "@/lib/chair-rentals/presentation";

describe("chair rental presentation", () => {
  it("formats billing periods for people", () => {
    expect(formatChairRentalPeriod("2026-10")).toBe("octubre de 2026");
  });

  it("keeps malformed periods visible without inventing a date", () => {
    expect(formatChairRentalPeriod("sin-periodo")).toBe("sin-periodo");
  });

  it("formats local dates in Spanish", () => {
    expect(formatBuenosAiresDate("2026-10-02")).toBe("2 de octubre de 2026");
  });

  it("formats payment timestamps in Buenos Aires", () => {
    expect(formatBuenosAiresDateTime("2026-10-02T15:30:00.000Z")).toContain("2 de octubre de 2026");
  });
});
