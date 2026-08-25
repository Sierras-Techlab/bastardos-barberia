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

const cashId = "60000000-0000-4000-8000-000000000001";
const transferId = "60000000-0000-4000-8000-000000000002";
const cardId = "60000000-0000-4000-8000-000000000003";

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
  sourceType: "sale",
  subscription: null,
  employee: employeeLautaro,
  registeredBy: employeeLautaro,
  customer: { id: "customer-lucas", firstName: "Lucas", lastName: "Romero" },
  service: {
    id: "service-haircut-eyebrows",
    name: "Corte de pelo y perfilado de cejas",
    price: 16000,
    commission: { subtotal: 16000, rate: 0, amount: 0, fullCommission: false, authorizedBy: null },
  },
  products: [],
  payments: [{ paymentMethodId: cashId, methodName: "Efectivo", amount: 16000 }],
  commission: { total: 0, barbershopNet: 16000 },
  total: 16000,
  status: "active",
};

const productsOnly: IncomeListItem = {
  id: "products-only",
  createdAt: "2026-08-06T18:00:00.000Z",
  businessDate: "2026-08-06",
  sourceType: "sale",
  subscription: null,
  employee: employeeFer,
  registeredBy: employeeFer,
  customer: null,
  service: null,
  products: [
    { id: "product-gel", name: "Gel", unitPrice: 9900, quantity: 2, commission: { subtotal: 19800, rate: 0, amount: 0, fullCommission: false, authorizedBy: null } },
  ],
  payments: [{ paymentMethodId: transferId, methodName: "Transferencia", amount: 19800 }],
  commission: { total: 0, barbershopNet: 19800 },
  total: 19800,
  status: "active",
};

const combined: IncomeListItem = {
  id: "combined",
  createdAt: "2026-08-05T16:00:00.000Z",
  businessDate: "2026-08-05",
  sourceType: "sale",
  subscription: null,
  employee: employeeLautaro,
  registeredBy: employeeLautaro,
  customer: {
    id: "customer-tomas",
    firstName: "Tomás",
    lastName: "Pereyra",
  },
  service: {
    id: "service-complete",
    name: "Corte, perfilado y barba",
    price: 19000,
    commission: { subtotal: 19000, rate: 0, amount: 0, fullCommission: false, authorizedBy: null },
  },
  products: [
    {
      id: "product-hunter",
      name: "Hunter Cream",
      unitPrice: 30000,
      quantity: 1,
      commission: { subtotal: 30000, rate: 0, amount: 0, fullCommission: false, authorizedBy: null },
    },
  ],
  payments: [{ paymentMethodId: cashId, methodName: "Efectivo", amount: 49000 }],
  commission: { total: 0, barbershopNet: 49000 },
  total: 49000,
  status: "active",
};

const emptyFilters: IncomeListFilters = {
  query: "",
  dateFrom: "2026-08-01",
  dateTo: "2026-08-31",
  employeeId: "",
  paymentMethodId: "all",
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
        paymentMethodId: cashId,
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

  it("filters and totals split payments by their actual allocations", () => {
    const split: IncomeListItem = {
      ...combined,
      payments: [
        { paymentMethodId: cashId, methodName: "Efectivo", amount: 20000 },
        { paymentMethodId: transferId, methodName: "Transferencia", amount: 19000 },
        { paymentMethodId: cardId, methodName: "Tarjeta", amount: 10000 },
      ],
    };

    expect(filterIncomeItems([split], {
      ...emptyFilters,
      paymentMethodId: cardId,
    })).toEqual([split]);
    const metrics = calculateIncomeMetrics([split]);
    expect("paymentTotals" in metrics ? metrics.paymentTotals : []).toEqual([
      { paymentMethodId: cashId, name: "Efectivo", amount: 20000 },
      { paymentMethodId: transferId, name: "Transferencia", amount: 19000 },
      { paymentMethodId: cardId, name: "Tarjeta", amount: 10000 },
    ]);
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
      grossTotal: 35800,
      commissionTotal: 0,
      barbershopNet: 35800,
      count: 2,
      average: 17900,
      paymentTotals: [
        { paymentMethodId: cashId, name: "Efectivo", amount: 16000 },
        { paymentMethodId: transferId, name: "Transferencia", amount: 19800 },
      ],
    });
    expect(calculateIncomeMetrics([voided])).toEqual({
      grossTotal: 0,
      commissionTotal: 0,
      barbershopNet: 0,
      count: 0,
      average: 0,
      paymentTotals: [],
    });
  });
});
