import { describe, expect, it, vi } from "vitest";

import type { SafeUser } from "@/lib/auth/types";
import type { CustomerRepository, CustomerServiceDependencies } from "@/lib/customers/contracts";
import { createCustomerSchema, customerIdSchema, updateCustomerSchema } from "@/lib/customers/schemas";
import { createCustomer, deleteCustomer, getLatestCustomer, listCustomers, updateCustomer } from "@/lib/customers/service";
import type { Customer } from "@/types/customer";
import type { FixedScheduleInput } from "@/types/fixed-customer";

const owner: SafeUser = { id: "00000000-0000-4000-8000-000000000001", firstName: "Ana", lastName: "García", username: "ana.garcia", role: { id: 1, name: "owner" }, isActive: true, serviceCommissionRate: 0, productCommissionRate: 0, lastLoginAt: null, createdAt: "2026-08-07T00:00:00.000Z", updatedAt: "2026-08-07T00:00:00.000Z" };
const admin: SafeUser = { ...owner, id: "00000000-0000-4000-8000-000000000002", username: "leo.admin", role: { id: 2, name: "admin" } };
const employee: SafeUser = { ...owner, id: "00000000-0000-4000-8000-000000000003", username: "fer.perez", role: { id: 3, name: "employee" } };
const otherEmployee: SafeUser = { ...employee, id: "00000000-0000-4000-8000-000000000004", username: "lu.perez", firstName: "Lu", lastName: "Pérez" };
const customer: Customer = { id: "10000000-0000-4000-8000-000000000001", firstName: "Ana", lastName: "Pérez", phone: "+54 351 555 0101", email: null, visits: 0, createdAt: "2026-08-11T10:00:00.000Z", fixedSchedule: null, fixedScheduleVersion: null };
const scheduleInput: FixedScheduleInput = { weekday: 4, time: "10:00", responsibleUserId: employee.id, monthlyPrice: 15000 };
const deps = (): CustomerServiceDependencies => ({
  customers: {
    list: vi.fn().mockResolvedValue([customer]), latest: vi.fn().mockResolvedValue(customer), findById: vi.fn().mockResolvedValue(customer),
    findByNormalizedPhone: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue(customer),
    update: vi.fn().mockResolvedValue(customer), softDelete: vi.fn().mockResolvedValue(customer.id),
    listVisits: vi.fn().mockResolvedValue({ items: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }),
  } satisfies CustomerRepository,
  now: () => "2026-08-11T12:00:00.000Z",
});

describe("customer schemas", () => {
  it("requires phone, permits duplicate names and normalizes optional email", () => {
    expect(createCustomerSchema.parse({ firstName: " Ana ", lastName: " Pérez ", phone: "+54 351 555 0101", email: "" }))
      .toMatchObject({ firstName: "Ana", lastName: "Pérez", phone: "+54 351 555 0101", email: null, fixedSchedule: null });
    expect(createCustomerSchema.safeParse({ firstName: "Ana", lastName: "Pérez", phone: "12", email: null }).success).toBe(false);
    expect(customerIdSchema.safeParse("customer-ana").success).toBe(false);
    expect(updateCustomerSchema.safeParse({}).success).toBe(false);
  });
});

describe("customer service", () => {
  it("returns the latest customer for every authenticated role", async () => {
    const dependencies = deps();

    await expect(getLatestCustomer(employee, dependencies)).resolves.toEqual(customer);
  });

  it("allows every authenticated role to list, create and edit", async () => {
    const dependencies = deps();
    await expect(listCustomers(employee, dependencies)).resolves.toEqual({ customers: [customer] });
    await createCustomer(employee, { firstName: "Ana", lastName: "Pérez", phone: customer.phone, email: null, fixedSchedule: null }, dependencies);
    await updateCustomer(employee, customer.id, { firstName: "Anita" }, dependencies);
    expect(dependencies.customers.create).toHaveBeenCalledWith(expect.objectContaining({ createdBy: employee.id }));
    expect(dependencies.customers.update).toHaveBeenCalledWith(customer.id, { firstName: "Anita", updatedBy: employee.id });
  });

  it("allows manager deletion and rejects employee deletion before persistence", async () => {
    const dependencies = deps();
    await expect(deleteCustomer(employee, customer.id, dependencies)).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
    await expect(deleteCustomer(owner, customer.id, dependencies)).resolves.toEqual({ id: customer.id });
    expect(dependencies.customers.softDelete).toHaveBeenCalledWith(customer.id, owner.id, "2026-08-11T12:00:00.000Z");
  });

  it("forces employee submitted schedules to use the actor as the responsible professional", async () => {
    const dependencies = deps();
    await createCustomer(employee, { firstName: "Ana", lastName: "Pérez", phone: customer.phone, email: null, fixedSchedule: { ...scheduleInput, responsibleUserId: otherEmployee.id } }, dependencies);
    await updateCustomer(employee, customer.id, { fixedSchedule: { ...scheduleInput, responsibleUserId: otherEmployee.id }, expectedScheduleVersion: 1 }, dependencies);
    const createCall = vi.mocked(dependencies.customers.create).mock.calls.at(-1)?.[0];
    const updateCall = vi.mocked(dependencies.customers.update).mock.calls.at(-1)?.[1];
    expect(createCall?.fixedSchedule?.responsibleUserId).toBe(employee.id);
    expect(updateCall?.fixedSchedule?.responsibleUserId).toBe(employee.id);
  });

  it("preserves a manager-selected professional without overriding it", async () => {
    const dependencies = deps();
    await createCustomer(admin, { firstName: "Ana", lastName: "Pérez", phone: customer.phone, email: null, fixedSchedule: { ...scheduleInput, responsibleUserId: otherEmployee.id } }, dependencies);
    await updateCustomer(admin, customer.id, { fixedSchedule: { ...scheduleInput, responsibleUserId: otherEmployee.id }, expectedScheduleVersion: 1 }, dependencies);
    const createCall = vi.mocked(dependencies.customers.create).mock.calls.at(-1)?.[0];
    const updateCall = vi.mocked(dependencies.customers.update).mock.calls.at(-1)?.[1];
    expect(createCall?.fixedSchedule?.responsibleUserId).toBe(otherEmployee.id);
    expect(updateCall?.fixedSchedule?.responsibleUserId).toBe(otherEmployee.id);
  });

  it("accepts a schedule without responsibleUserId so employees can submit forced-self", async () => {
    const dependencies = deps();
    const { responsibleUserId, ...rest } = scheduleInput;
    void responsibleUserId;
    await createCustomer(employee, { firstName: "Ana", lastName: "Pérez", phone: customer.phone, email: null, fixedSchedule: rest }, dependencies);
    const createCall = vi.mocked(dependencies.customers.create).mock.calls.at(-1)?.[0];
    expect(createCall?.fixedSchedule?.responsibleUserId).toBe(employee.id);
  });
});
