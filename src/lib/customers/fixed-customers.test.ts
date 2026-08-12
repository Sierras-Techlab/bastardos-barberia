import { expect, it } from "vitest";
import { buildUpcomingFixedOccurrences, formatFixedSchedule, sortFixedOccurrences, updateOccurrenceStatus } from "./fixed-customers";

it("formats one weekly schedule in Spanish", () => {
  expect(formatFixedSchedule({ weekday: 4, time: "10:00" })).toBe("Todos los jueves a las 10:00");
});

it("sorts occurrences by local date and time", () => {
  const later = { id: "2", customer: { id: "c2", firstName: "Pucho", lastName: "" }, date: "2026-08-14", time: "13:00", status: "pending" as const };
  const earlier = { id: "1", customer: { id: "c1", firstName: "Juan", lastName: "" }, date: "2026-08-13", time: "10:00", status: "pending" as const };
  expect(sortFixedOccurrences([later, earlier]).map(({ id }) => id)).toEqual(["1", "2"]);
});

it("updates only the selected occurrence", () => {
  const occurrences = [
    { id: "1", customer: { id: "c1", firstName: "Juan", lastName: "" }, date: "2026-08-13", time: "10:00", status: "pending" as const },
    { id: "2", customer: { id: "c1", firstName: "Juan", lastName: "" }, date: "2026-08-20", time: "10:00", status: "pending" as const },
  ];
  expect(updateOccurrenceStatus(occurrences, "1", "attended").map(({ status }) => status)).toEqual(["attended", "pending"]);
});

it("projects each weekly schedule to today or its next upcoming weekday", () => {
  const projected = buildUpcomingFixedOccurrences([
    { id: "schedule-1", customer: { id: "customer-1", firstName: "Juan", lastName: "Cruz" }, schedule: { weekday: 3, time: "10:00" } },
    { id: "schedule-2", customer: { id: "customer-2", firstName: "Ana", lastName: "Pérez" }, schedule: { weekday: 4, time: "09:00" } },
    { id: "schedule-3", customer: { id: "customer-3", firstName: "Pedro", lastName: "Gómez" }, schedule: { weekday: 7, time: "15:00" } },
  ], "2026-08-12");
  expect(projected.map(({ date, status }) => ({ date, status }))).toEqual([
    { date: "2026-08-12", status: "pending" },
    { date: "2026-08-13", status: "pending" },
    { date: "2026-08-16", status: "pending" },
  ]);
});
