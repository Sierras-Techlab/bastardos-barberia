import { expect, it } from "vitest";
import { createCustomerSchema, fixedScheduleInputSchema, fixedScheduleSchema, updateCustomerSchema } from "./schemas";
import { frontendCustomerEditorSchema } from "./frontend-customer-contracts";

const validScheduleOutput = {
  weekday: 4,
  time: "10:00",
  responsibleProfessional: { id: "00000000-0000-4000-8000-000000000003", firstName: "Fer", lastName: "Pérez" },
  monthlyPrice: 15000,
};
const validScheduleInput = {
  weekday: 4,
  time: "10:00",
  responsibleUserId: "00000000-0000-4000-8000-000000000003",
  monthlyPrice: 15000,
};

it("accepts one valid weekly schedule and null", () => {
  expect(fixedScheduleSchema.safeParse(validScheduleOutput).success).toBe(true);
  expect(fixedScheduleInputSchema.safeParse(validScheduleInput).success).toBe(true);
  expect(fixedScheduleInputSchema.parse(validScheduleInput)).toEqual(validScheduleInput);
  expect(frontendCustomerEditorSchema.safeParse({ firstName: "Juan", lastName: "Cruz", phone: "3515550101", email: null, fixedSchedule: null }).success).toBe(true);
  expect(frontendCustomerEditorSchema.safeParse({ firstName: "Juan", lastName: "Cruz", phone: "3515550101", email: null, fixedSchedule: validScheduleInput }).success).toBe(true);
  expect(createCustomerSchema.parse({ firstName: "Juan", lastName: "Cruz", phone: "3515550101", email: null })).toMatchObject({ fixedSchedule: null });
  expect(createCustomerSchema.parse({ firstName: "Juan", lastName: "Cruz", phone: "3515550101", email: null, fixedSchedule: validScheduleInput }))
    .toMatchObject({ fixedSchedule: validScheduleInput });
  expect(updateCustomerSchema.parse({ fixedSchedule: null, expectedScheduleVersion: 2 }))
    .toMatchObject({ fixedSchedule: null, expectedScheduleVersion: 2 });
  expect(updateCustomerSchema.safeParse({ fixedSchedule: null }).success).toBe(false);
});

it("rejects invalid weekdays and loose time values", () => {
  expect(fixedScheduleSchema.safeParse({ ...validScheduleOutput, weekday: 0 }).success).toBe(false);
  expect(fixedScheduleSchema.safeParse({ ...validScheduleOutput, time: "10:0" }).success).toBe(false);
  expect(fixedScheduleSchema.safeParse({ ...validScheduleOutput, time: "25:00" }).success).toBe(false);
});

it("rejects non-positive or non-integer monthly prices on both shapes", () => {
  expect(fixedScheduleSchema.safeParse({ ...validScheduleOutput, monthlyPrice: 0 }).success).toBe(false);
  expect(fixedScheduleSchema.safeParse({ ...validScheduleOutput, monthlyPrice: -100 }).success).toBe(false);
  expect(fixedScheduleSchema.safeParse({ ...validScheduleOutput, monthlyPrice: 1.5 }).success).toBe(false);
  expect(fixedScheduleInputSchema.safeParse({ ...validScheduleInput, monthlyPrice: 0 }).success).toBe(false);
  expect(fixedScheduleInputSchema.safeParse({ ...validScheduleInput, monthlyPrice: 15000.5 }).success).toBe(false);
  expect(fixedScheduleInputSchema.safeParse({ ...validScheduleInput, responsibleUserId: "not-a-uuid" }).success).toBe(false);
});

it("allows omitting responsibleUserId so employees can submit forced-self schedules", () => {
  const { responsibleUserId: _ignored, ...rest } = validScheduleInput;
  expect(fixedScheduleInputSchema.safeParse(rest).success).toBe(true);
});
