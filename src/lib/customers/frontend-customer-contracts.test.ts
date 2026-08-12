import { expect, it } from "vitest";
import { fixedScheduleSchema, frontendCustomerEditorSchema } from "./frontend-customer-contracts";

it("accepts one valid weekly schedule and null", () => {
  expect(fixedScheduleSchema.safeParse({ weekday: 4, time: "10:00" }).success).toBe(true);
  expect(frontendCustomerEditorSchema.safeParse({ firstName: "Juan", lastName: "Cruz", phone: "3515550101", email: null, fixedSchedule: null }).success).toBe(true);
});

it("rejects invalid weekdays and loose time values", () => {
  expect(fixedScheduleSchema.safeParse({ weekday: 0, time: "10:00" }).success).toBe(false);
  expect(fixedScheduleSchema.safeParse({ weekday: 4, time: "10:0" }).success).toBe(false);
  expect(fixedScheduleSchema.safeParse({ weekday: 4, time: "25:00" }).success).toBe(false);
});
