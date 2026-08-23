import { describe, expect, it } from "vitest";

import customersMock from "@/data/customers.mock.json";
import {
  authorizeCustomerCatalogData,
  calculateCustomerMetrics,
  customerEditorSchema,
  filterCustomers,
  sortCustomers,
  validateUniqueCustomerContact,
} from "@/lib/customers/customer-catalog";

const data = authorizeCustomerCatalogData(customersMock);

describe("customer catalog", () => {
  it("strictly validates the fixture", () => {
    expect(data.customers.length).toBeGreaterThan(10);
    expect(() => authorizeCustomerCatalogData({ ...data, extra: true })).toThrow();
  });

  it("accepts PostgreSQL ISO datetimes with an explicit UTC offset", () => {
    const customer = {
      ...data.customers[0],
      createdAt: "2026-08-23T03:40:15.123+00:00",
    };

    expect(authorizeCustomerCatalogData({ customers: [customer] }).customers[0].createdAt)
      .toBe("2026-08-23T03:40:15.123+00:00");
  });

  it("searches identity and normalized contact fields", () => {
    expect(filterCustomers(data.customers, "lucas").map(({ firstName }) => firstName)).toEqual(["Lucas"]);
    expect(filterCustomers(data.customers, "3515550101")).toHaveLength(1);
    expect(filterCustomers(data.customers, "@gmail.com").length).toBeGreaterThan(1);
  });

  it("filters customers by fixed schedule without losing text search", () => {
    const customers = [
      { ...data.customers[0], fixedSchedule: { weekday: 4 as const, time: "10:00", responsibleProfessional: { id: "00000000-0000-4000-8000-000000000099", firstName: "Pro", lastName: "One" }, monthlyPrice: 15000 } },
      { ...data.customers[1], fixedSchedule: null },
    ];

    expect(filterCustomers(customers, "", "fixed")).toEqual([customers[0]]);
    expect(filterCustomers(customers, "", "not-fixed")).toEqual([customers[1]]);
    expect(filterCustomers(customers, customers[0].firstName, "fixed")).toEqual([customers[0]]);
    expect(filterCustomers(customers, customers[1].firstName, "fixed")).toEqual([]);
  });

  it("sorts visits and dates without mutating the fixture", () => {
    const original = data.customers.map(({ id }) => id);
    expect(sortCustomers(data.customers, "visits-desc")[0].visits).toBe(
      Math.max(...data.customers.map(({ visits }) => visits)),
    );
    expect(sortCustomers(data.customers, "newest")[0].createdAt).toBe(
      [...data.customers].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0].createdAt,
    );
    expect(data.customers.map(({ id }) => id)).toEqual(original);
  });

  it("calculates customer and visit metrics", () => {
    const metrics = calculateCustomerMetrics(data.customers);
    expect(metrics.totalCustomers).toBe(data.customers.length);
    expect(metrics.totalVisits).toBe(
      data.customers.reduce((total, customer) => total + customer.visits, 0),
    );
    expect(metrics.newCustomers).toBeGreaterThan(0);
  });

  it("requires valid identity and contact data", () => {
    expect(customerEditorSchema.safeParse({ firstName: "", lastName: "", email: "bad", phone: "12" }).success).toBe(false);
    expect(customerEditorSchema.safeParse({ firstName: "Pedro", lastName: "Castañeda", email: "pedro.castañeda@gmail.com", phone: "3515550200" }).error?.issues[0]?.message).toBe("Ingresá un email válido, sin ñ ni acentos.");
    expect(customerEditorSchema.parse({ firstName: " Ana ", lastName: " Díaz ", email: " ANA@MAIL.COM ", phone: "+54 351 555-0101" })).toEqual({
      firstName: "Ana",
      lastName: "Díaz",
      email: "ana@mail.com",
      phone: "+54 351 555-0101",
      fixedSchedule: null,
    });
    expect(customerEditorSchema.parse({ firstName: "Ana", lastName: "Díaz", email: "", phone: "+54 351 555-0101" }).email).toBeNull();
  });

  it("rejects normalized duplicate email and phone while allowing self edits", () => {
    const first = data.customers[0];
    expect(validateUniqueCustomerContact({ email: ` ${first.email!.toUpperCase()} `, phone: "9999999999" }, data.customers)).toBe("Ya existe un cliente con ese email.");
    expect(validateUniqueCustomerContact({ email: "otro@mail.com", phone: first.phone.replaceAll(" ", "") }, data.customers)).toBe("Ya existe un cliente con ese teléfono.");
    expect(validateUniqueCustomerContact({ email: first.email, phone: first.phone }, data.customers, first.id)).toBeNull();
  });
});
