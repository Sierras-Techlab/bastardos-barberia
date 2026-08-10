import { describe, expect, it } from "vitest";

import servicesMock from "@/data/services.mock.json";
import {
  authorizeServiceCatalogData,
  calculateServiceMetrics,
  filterServices,
  serviceEditorSchema,
  sortServices,
  validateUniqueServiceName,
} from "@/lib/services/service-catalog";

const data = authorizeServiceCatalogData(servicesMock);

describe("service catalog", () => {
  it("strictly validates the initial catalog", () => {
    expect(data.services).toHaveLength(3);
    expect(data.services.map(({ price }) => price)).toEqual([16000, 13000, 19000]);
    expect(() => authorizeServiceCatalogData({ ...data, unexpected: true })).toThrow();
  });

  it("searches names and filters active state", () => {
    expect(filterServices(data.services, { query: "barba", activeState: "all" })).toHaveLength(2);
    expect(filterServices(data.services, { query: "", activeState: "active" })).toHaveLength(3);
    expect(filterServices([{ ...data.services[0], isActive: false }], { query: "", activeState: "inactive" })).toHaveLength(1);
  });

  it("sorts by name and price without mutation", () => {
    const original = data.services.map(({ id }) => id);
    expect(sortServices(data.services, "price-asc")[0].price).toBe(13000);
    expect(sortServices(data.services, "price-desc")[0].price).toBe(19000);
    expect(sortServices(data.services, "name-asc")[0].name).toBe("Barba");
    expect(data.services.map(({ id }) => id)).toEqual(original);
  });

  it("calculates active count, average and range", () => {
    expect(calculateServiceMetrics(data.services)).toEqual({
      activeServices: 3,
      averagePrice: 16000,
      minimumPrice: 13000,
      maximumPrice: 19000,
    });
  });

  it("requires a name and positive integer price", () => {
    expect(serviceEditorSchema.safeParse({ name: "", price: 0 }).success).toBe(false);
    expect(serviceEditorSchema.safeParse({ name: "Barba", price: 13000.5 }).success).toBe(false);
    expect(serviceEditorSchema.parse({ name: "  Corte premium  ", price: 20000 })).toEqual({ name: "Corte premium", price: 20000 });
  });

  it("rejects normalized duplicate names but permits self edits", () => {
    const first = data.services[0];
    expect(validateUniqueServiceName(` ${first.name.toUpperCase()} `, data.services)).toBe("Ya existe un servicio con ese nombre.");
    expect(validateUniqueServiceName(first.name, data.services, first.id)).toBeNull();
  });
});
