import { describe, expect, it, vi } from "vitest";
import type { SafeUser } from "@/lib/auth/types";
import type { IncomeDependencies, IncomeRepository } from "@/lib/incomes/contracts";
import { createIncomeSchema } from "@/lib/incomes/income-schema";
import { createIncome, getIncome, listIncomes, voidIncome } from "@/lib/incomes/service";

const owner: SafeUser = { id: "00000000-0000-4000-8000-000000000001", firstName: "Ana", lastName: "García", username: "ana.garcia", role: { id: 1, name: "owner" }, isActive: true, serviceCommissionRate: 0, productCommissionRate: 0, lastLoginAt: null, createdAt: "2026-08-07T00:00:00.000Z", updatedAt: "2026-08-07T00:00:00.000Z" };
const employee: SafeUser = { ...owner, id: "00000000-0000-4000-8000-000000000003", username: "fer.perez", role: { id: 3, name: "employee" } };
const income = { id: "20000000-0000-4000-8000-000000000001", createdAt: "2026-08-11T12:00:00.000Z", businessDate: "2026-08-11", employee: { id: employee.id, firstName: "Fer", lastName: "Pérez" }, customer: null, service: { id: "30000000-0000-4000-8000-000000000001", name: "Barba", price: 13000 }, products: [], paymentMethod: "cash" as const, total: 13000, status: "active" as const };
const repository = (): IncomeRepository => ({ create: vi.fn().mockResolvedValue(income), list: vi.fn().mockResolvedValue({ items: [income], metrics: { total: 13000, count: 1, average: 13000, cashTotal: 13000, transferTotal: 0 }, pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 } }), findById: vi.fn().mockResolvedValue(income), void: vi.fn().mockResolvedValue({ ...income, status: "voided" }) });
const valid = {
  requestId: "40000000-0000-4000-8000-000000000001",
  employeeId: employee.id,
  customerId: null,
  serviceId: "30000000-0000-4000-8000-000000000001",
  products: [],
  payments: [{ method: "cash" as const, amount: 13000 }],
  grantFullServiceCommission: false,
};

describe("income boundary", () => {
  it("accepts the strict V2 composition and payments", () => {
    expect(createIncomeSchema.parse(valid)).toEqual(valid);
    expect(createIncomeSchema.safeParse({ ...valid, total: 1 }).success).toBe(false);
    expect(createIncomeSchema.safeParse({ ...valid, products: [{ productId: valid.serviceId, quantity: 1 }, { productId: valid.serviceId, quantity: 2 }] }).success).toBe(false);
  });
});

describe("income service", () => {
  it("forces employees to attribute creation to themselves", async () => {
    const incomes = repository(); const deps: IncomeDependencies = { incomes };
    await createIncome(employee, { ...valid, employeeId: owner.id }, deps);
    expect(incomes.create).toHaveBeenCalledWith(employee, { ...valid, employeeId: employee.id });
  });
  it("preserves a manager-selected responsible employee", async () => {
    const incomes = repository(); const deps: IncomeDependencies = { incomes };
    await createIncome(owner, valid, deps);
    expect(incomes.create).toHaveBeenCalledWith(owner, valid);
  });
  it("scopes employee list/detail and permits manager-wide reads", async () => {
    const employeeRepo = repository(); const ownerRepo = repository();
    await listIncomes(employee, { page: 1, pageSize: 10 }, { incomes: employeeRepo });
    await listIncomes(owner, { page: 1, pageSize: 10, userId: employee.id }, { incomes: ownerRepo });
    await getIncome(employee, income.id, { incomes: employeeRepo });
    expect(employeeRepo.list).toHaveBeenCalledWith({ requestingUserId: employee.id, canViewAll: false, userId: employee.id }, expect.anything());
    expect(ownerRepo.list).toHaveBeenCalledWith({ requestingUserId: owner.id, canViewAll: true, userId: employee.id }, expect.anything());
    expect(employeeRepo.findById).toHaveBeenCalledWith({ requestingUserId: employee.id, canViewAll: false, userId: employee.id }, income.id);
  });
  it("allows only managers to void", async () => {
    const incomes = repository();
    await expect(voidIncome(employee, income.id, { incomes })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await voidIncome(owner, income.id, { incomes });
    expect(incomes.void).toHaveBeenCalledWith(income.id, owner.id);
  });
});
