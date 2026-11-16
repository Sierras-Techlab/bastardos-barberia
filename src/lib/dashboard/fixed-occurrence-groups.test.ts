import { describe, expect, it } from "vitest";

import { groupFixedOccurrencesByTime } from "@/lib/dashboard/fixed-occurrence-groups";
import type { FixedCustomerOccurrence } from "@/types/fixed-customer";

const occurrence = (
  id: string,
  date: string,
  time: string,
  status: FixedCustomerOccurrence["status"] = "pending",
): FixedCustomerOccurrence => ({
  id,
  date,
  time,
  status,
  customer: { id: `customer-${id}`, firstName: "Cliente", lastName: id },
});

describe("groupFixedOccurrencesByTime", () => {
  const reference = new Date("2026-11-12T18:00:00.000Z");

  it("separates passed, exact-time, and future pending visits against Buenos Aires time", () => {
    const groups = groupFixedOccurrencesByTime([
      occurrence("passed", "2026-11-12", "14:30"),
      occurrence("exact", "2026-11-12", "15:00"),
      occurrence("future", "2026-11-12", "16:00"),
    ], reference);

    expect(groups.upcoming.map(({ id }) => id)).toEqual(["future"]);
    expect(groups.unrecorded.map(({ id }) => id)).toEqual(["passed", "exact"]);
  });

  it("keeps Friday and Saturday pending visits upcoming and resolved visits text-only", () => {
    const groups = groupFixedOccurrencesByTime([
      occurrence("friday", "2026-11-13", "09:00"),
      occurrence("saturday", "2026-11-14", "09:00"),
      occurrence("attended", "2026-11-12", "14:30", "attended"),
      occurrence("missed", "2026-11-12", "16:00", "missed"),
    ], reference);

    expect(groups.upcoming.map(({ id }) => id)).toEqual(["friday", "saturday"]);
    expect(groups.unrecorded).toEqual([]);
    expect(groups.resolved.map(({ id }) => id)).toEqual(["attended", "missed"]);
  });

  it("returns all groups empty on Sunday without widening into next week", () => {
    const groups = groupFixedOccurrencesByTime([
      occurrence("next-monday", "2026-11-16", "09:00"),
    ], new Date("2026-11-15T15:00:00.000Z"));

    expect(groups).toEqual({ upcoming: [], unrecorded: [], resolved: [] });
  });

  it("drops yesterday's occurrences when the local workweek advances while open", () => {
    const groups = groupFixedOccurrencesByTime([
      occurrence("thursday", "2026-11-12", "14:30"),
      occurrence("friday", "2026-11-13", "09:00"),
      occurrence("saturday", "2026-11-14", "09:00"),
    ], new Date("2026-11-13T03:15:00.000Z"));

    expect(groups.unrecorded.map(({ id }) => id)).toEqual([]);
    expect(groups.upcoming.map(({ id }) => id)).toEqual(["friday", "saturday"]);
  });
});
