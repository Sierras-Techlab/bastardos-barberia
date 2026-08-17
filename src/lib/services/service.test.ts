import { describe, expect, it, vi } from "vitest";

import type { SafeUser } from "@/lib/auth/types";
import type {
  ServiceRepository,
  ServiceServiceDependencies,
} from "@/lib/services/contracts";
import {
  createServiceSchema,
  serviceIdSchema,
  updateServiceSchema,
} from "@/lib/services/schemas";
import {
  createService,
  deleteService,
  listServices,
  updateService,
} from "@/lib/services/service";
import type { ServiceCatalogItem } from "@/types/service-catalog";

const owner: SafeUser = {
  id: "00000000-0000-4000-8000-000000000001",
  firstName: "Ana",
  lastName: "García",
  username: "ana.garcia",
  role: { id: 1, name: "owner" },
  isActive: true,
  serviceCommissionRate: 0,
  productCommissionRate: 0,
  lastLoginAt: null,
  createdAt: "2026-08-07T00:00:00.000Z",
  updatedAt: "2026-08-07T00:00:00.000Z",
};
const employee: SafeUser = {
  ...owner,
  id: "00000000-0000-4000-8000-000000000003",
  username: "fer.perez",
  role: { id: 3, name: "employee" },
};
const service: ServiceCatalogItem = {
  id: "10000000-0000-4000-8000-000000000001",
  name: "Barba",
  price: 13000,
  isActive: true,
};

const dependencies = (): ServiceServiceDependencies => ({
  services: {
    list: vi.fn().mockResolvedValue([service]),
    findById: vi.fn().mockResolvedValue(service),
    create: vi.fn().mockResolvedValue(service),
    update: vi.fn().mockResolvedValue(service),
    softDelete: vi.fn().mockResolvedValue(service.id),
  } satisfies ServiceRepository,
  now: () => "2026-08-11T12:00:00.000Z",
});

describe("service boundary schemas", () => {
  it("trims names and requires positive integer prices", () => {
    expect(createServiceSchema.parse({ name: "  Barba  ", price: 13000 }))
      .toEqual({ name: "Barba", price: 13000 });
    expect(createServiceSchema.safeParse({ name: "", price: 0 }).success)
      .toBe(false);
    expect(createServiceSchema.safeParse({ name: "Barba", price: 1.5 }).success)
      .toBe(false);
  });

  it("rejects invalid ids, unknown fields and empty updates", () => {
    expect(serviceIdSchema.safeParse("service-beard").success).toBe(false);
    expect(updateServiceSchema.safeParse({}).success).toBe(false);
    expect(updateServiceSchema.safeParse({ deletedAt: null }).success).toBe(false);
  });
});

describe("service domain", () => {
  it("shows all services to managers and active-only services to employees", async () => {
    const managerDeps = dependencies();
    const employeeDeps = dependencies();

    await expect(listServices(owner, managerDeps)).resolves.toEqual({ services: [service] });
    await expect(listServices(employee, employeeDeps)).resolves.toEqual({ services: [service] });
    expect(managerDeps.services.list).toHaveBeenCalledWith(true);
    expect(employeeDeps.services.list).toHaveBeenCalledWith(false);
  });

  it("rejects employee mutations before persistence", async () => {
    const deps = dependencies();
    await expect(createService(employee, { name: "Barba", price: 13000 }, deps))
      .rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
    await expect(deleteService(employee, service.id, deps))
      .rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
    expect(deps.services.create).not.toHaveBeenCalled();
    expect(deps.services.softDelete).not.toHaveBeenCalled();
  });

  it("propagates the authenticated manager to every mutation", async () => {
    const deps = dependencies();
    await createService(owner, { name: "Barba", price: 13000 }, deps);
    await updateService(owner, service.id, { price: 14000 }, deps);
    await deleteService(owner, service.id, deps);

    expect(deps.services.create).toHaveBeenCalledWith({
      name: "Barba", price: 13000, createdBy: owner.id,
    });
    expect(deps.services.update).toHaveBeenCalledWith(service.id, {
      price: 14000, updatedBy: owner.id,
    });
    expect(deps.services.softDelete).toHaveBeenCalledWith(
      service.id, owner.id, "2026-08-11T12:00:00.000Z",
    );
  });

  it("reports missing services", async () => {
    const deps = dependencies();
    vi.mocked(deps.services.update).mockResolvedValue(null);
    await expect(updateService(owner, service.id, { isActive: false }, deps))
      .rejects.toMatchObject({ code: "SERVICE_NOT_FOUND", status: 404 });
  });
});
