import { describe, expect, it } from "vitest";

import type {
  IncomeListFilters,
  IncomeListItem,
} from "@/types/income";
import {
  calculateIncomeMetrics,
  filterIncomeItems,
  formatIncomeConcept,
  getIncomeKind,
  sortIncomeItems,
} from "./income-list";

const employeeLautaro = {
  id: "employee-lautaro",
  firstName: "Lautaro",
  lastName: "Bastardos",
};

const employeeFer = {
  id: "employee-fer",
  firstName: "Fernanda",
  lastName: "Pérez",
};

const serviceOnly: IncomeListItem = {
  id: "service-only",
  createdAt: "2026-08-07T14:00:00.000Z",
  businessDate: "2026-08-07",
  employee: employeeLautaro,
  customer: { id: "customer-lucas", firstName: "Lucas", lastName: "Romero" },
  service: {
    id: "service-haircut-eyebrows",
    name: "Corte de pelo y perfilado de cejas",
    price: 16000,
  },
  products: [],
  paymentMethod: "cash",
  total: 16000,
  status: "active",
};

const productsOnly: IncomeListItem = {
  id: "products-only",
  createdAt: "2026-08-06T18:00:00.000Z",
  businessDate: "2026-08-06",
  employee: employeeFer,
  customer: null,
  service: null,
  products: [
    { id: "product-gel", name: "Gel", unitPrice: 9900, quantity: 2 },
  ],
  paymentMethod: "transfer",
  total: 19800,
  status: "active",
};

const combined: IncomeListItem = {
  id: "combined",
  createdAt: "2026-08-05T16:00:00.000Z",
  businessDate: "2026-08-05",
  employee: employeeLautaro,
  customer: {
    id: "customer-tomas",
    firstName: "Tomás",
    lastName: "Pereyra",
  },
  service: {
    id: "service-complete",
    name: "Corte, perfilado y barba",
    price: 19000,
  },
  products: [
    {
      id: "product-hunter",
      name: "Hunter Cream",
      unitPrice: 30000,
      quantity: 1,
    },
  ],
  paymentMethod: "cash",
  total: 49000,
  status: "active",
};

const emptyFilters: IncomeListFilters = {
  query: "",
  dateFrom: "2026-08-01",
  dateTo: "2026-08-31",
  employeeId: "",
  paymentMethod: "all",
  kind: "all",
};

describe("income list domain", () => {
  it("classifies and describes every supported sale composition", () => {
    expect(getIncomeKind(serviceOnly)).toBe("service");
    expect(getIncomeKind(productsOnly)).toBe("products");
    expect(getIncomeKind(combined)).toBe("combined");

    expect(formatIncomeConcept(serviceOnly)).toBe(
      "Corte de pelo y perfilado de cejas",
    );
    expect(formatIncomeConcept(productsOnly)).toBe("2 productos");
    expect(formatIncomeConcept(combined)).toBe(
      "Corte, perfilado y barba + 1 producto",
    );
  });

  it("searches customers, services, products and employees", () => {
    const items = [serviceOnly, productsOnly, combined];

    expect(
      filterIncomeItems(items, { ...emptyFilters, query: "tomás" }),
    ).toEqual([combined]);
    expect(
      filterIncomeItems(items, { ...emptyFilters, query: "tomas" }),
    ).toEqual([combined]);
    expect(
      filterIncomeItems(items, { ...emptyFilters, query: "gel" }),
    ).toEqual([productsOnly]);
    expect(
      filterIncomeItems(items, { ...emptyFilters, query: "fernanda" }),
    ).toEqual([productsOnly]);
  });

  it("combines employee, payment, kind and inclusive date filters", () => {
    const items = [serviceOnly, productsOnly, combined];

    expect(
      filterIncomeItems(items, {
        ...emptyFilters,
        employeeId: "employee-lautaro",
        paymentMethod: "cash",
        kind: "combined",
        dateFrom: "2026-08-05",
        dateTo: "2026-08-05",
      }),
    ).toEqual([combined]);

    expect(
      filterIncomeItems(items, {
        ...emptyFilters,
        employeeId: "employee-fer",
      }),
    ).toEqual([productsOnly]);
  });

  it("sorts newest first without mutating the source", () => {
    const source = [combined, serviceOnly, productsOnly];

    expect(sortIncomeItems(source).map((item) => item.id)).toEqual([
      "service-only",
      "products-only",
      "combined",
    ]);
    expect(source.map((item) => item.id)).toEqual([
      "combined",
      "service-only",
      "products-only",
    ]);
  });

  it("excludes voided entries from all metrics", () => {
    const voided: IncomeListItem = {
      ...combined,
      id: "voided",
      total: 90000,
      status: "voided",
    };

    expect(calculateIncomeMetrics([serviceOnly, productsOnly, voided])).toEqual({
      total: 35800,
      count: 2,
      average: 17900,
      cashTotal: 16000,
      transferTotal: 19800,
    });
    expect(calculateIncomeMetrics([voided])).toEqual({
      total: 0,
      count: 0,
      average: 0,
      cashTotal: 0,
      transferTotal: 0,
    });
  });
});
