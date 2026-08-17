import { expect, it } from "vitest";
import { createCustomerSchema, fixedScheduleSchema, updateCustomerSchema } from "./schemas";
import { frontendCustomerEditorSchema } from "./frontend-customer-contracts";

it("accepts one valid weekly schedule and null", () => {
  expect(fixedScheduleSchema.safeParse({ weekday: 4, time: "10:00" }).success).toBe(true);
  expect(frontendCustomerEditorSchema.safeParse({ firstName: "Juan", lastName: "Cruz", phone: "3515550101", email: null, fixedSchedule: null }).success).toBe(true);
  expect(createCustomerSchema.parse({ firstName: "Juan", lastName: "Cruz", phone: "3515550101", email: null })).toMatchObject({ fixedSchedule: null });
  expect(updateCustomerSchema.parse({ fixedSchedule: null, expectedScheduleVersion: 2 }))
    .toEqual({ fixedSchedule: null, expectedScheduleVersion: 2 });
  expect(updateCustomerSchema.safeParse({ fixedSchedule: null }).success).toBe(false);
});

it("rejects invalid weekdays and loose time values", () => {
  expect(fixedScheduleSchema.safeParse({ weekday: 0, time: "10:00" }).success).toBe(false);
  expect(fixedScheduleSchema.safeParse({ weekday: 4, time: "10:0" }).success).toBe(false);
  expect(fixedScheduleSchema.safeParse({ weekday: 4, time: "25:00" }).success).toBe(false);
});
