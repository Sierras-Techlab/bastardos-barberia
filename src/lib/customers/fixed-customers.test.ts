import { expect, it } from "vitest";
import { formatFixedSchedule, sortFixedOccurrences } from "./fixed-customers";

it("formats one weekly schedule in Spanish", () => {
  expect(formatFixedSchedule({ weekday: 4, time: "10:00" })).toBe("Todos los jueves a las 10:00");
});

it("sorts persisted occurrences by local date and time", () => {
  const later = { id: "2", customer: { id: "c2", firstName: "Pucho", lastName: "" }, date: "2026-08-14", time: "13:00", status: "pending" as const };
  const earlier = { id: "1", customer: { id: "c1", firstName: "Juan", lastName: "" }, date: "2026-08-13", time: "10:00", status: "pending" as const };
  expect(sortFixedOccurrences([later, earlier]).map(({ id }) => id)).toEqual(["1", "2"]);
});
