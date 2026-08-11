import { describe, expect, it, vi } from "vitest";

import type { SafeUser } from "@/lib/auth/types";
import type { CustomerRepository, CustomerServiceDependencies } from "@/lib/customers/contracts";
import { createCustomerSchema, customerIdSchema, updateCustomerSchema } from "@/lib/customers/schemas";
import { createCustomer, deleteCustomer, getLatestCustomer, listCustomers, updateCustomer } from "@/lib/customers/service";
import type { Customer } from "@/types/customer";

const owner: SafeUser = { id: "00000000-0000-4000-8000-000000000001", firstName: "Ana", lastName: "García", username: "ana.garcia", role: { id: 1, name: "owner" }, isActive: true, lastLoginAt: null, createdAt: "2026-08-07T00:00:00.000Z", updatedAt: "2026-08-07T00:00:00.000Z" };
const employee: SafeUser = { ...owner, id: "00000000-0000-4000-8000-000000000003", username: "fer.perez", role: { id: 3, name: "employee" } };
const customer: Customer = { id: "10000000-0000-4000-8000-000000000001", firstName: "Ana", lastName: "Pérez", phone: "+54 351 555 0101", email: null, visits: 0, createdAt: "2026-08-11T10:00:00.000Z" };
const deps = (): CustomerServiceDependencies => ({
  customers: {
    list: vi.fn().mockResolvedValue([customer]), latest: vi.fn().mockResolvedValue(customer), findById: vi.fn().mockResolvedValue(customer),
    findByNormalizedPhone: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue(customer),
    update: vi.fn().mockResolvedValue(customer), softDelete: vi.fn().mockResolvedValue(customer.id),
  } satisfies CustomerRepository,
  now: () => "2026-08-11T12:00:00.000Z",
});

describe("customer schemas", () => {
  it("requires phone, permits duplicate names and normalizes optional email", () => {
    expect(createCustomerSchema.parse({ firstName: " Ana ", lastName: " Pérez ", phone: "+54 351 555 0101", email: "" }))
      .toEqual({ firstName: "Ana", lastName: "Pérez", phone: "+54 351 555 0101", email: null });
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
    await createCustomer(employee, { firstName: "Ana", lastName: "Pérez", phone: customer.phone, email: null }, dependencies);
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
});
