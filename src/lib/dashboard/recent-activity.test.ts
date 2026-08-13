import { describe, expect, it } from "vitest";

import {
  buildCustomerActivity,
  buildIncomeActivity,
} from "@/lib/dashboard/recent-activity";
import type { Customer } from "@/types/customer";
import type { IncomeListItem } from "@/types/income";

const now = new Date("2026-08-11T15:00:00.000Z");
const income: IncomeListItem = {
  id: "20000000-0000-4000-8000-000000000001",
  createdAt: "2026-08-11T14:48:00.000Z",
  businessDate: "2026-08-11",
  employee: {
    id: "00000000-0000-4000-8000-000000000003",
    firstName: "Fer",
    lastName: "Pérez",
  },
  customer: null,
  service: {
    id: "30000000-0000-4000-8000-000000000001",
    name: "Barba",
    price: 5000,
  },
  products: [
    {
      id: "40000000-0000-4000-8000-000000000001",
      name: "Gel",
      unitPrice: 5000,
      quantity: 2,
    },
  ],
  paymentMethod: "cash",
  total: 15000,
  status: "active",
};
const customer: Customer = {
  id: "10000000-0000-4000-8000-000000000001",
  firstName: "Ana",
  lastName: "Pérez",
  phone: "3515550101",
  email: null,
  visits: 0,
  createdAt: "2026-08-11T14:00:00.000Z",
  fixedSchedule: null,
};

describe("dashboard recent activity", () => {
  it("describes the latest persisted income with its snapshots and total", () => {
    expect(buildIncomeActivity(income, now)).toEqual({
      id: income.id,
      type: "income",
      title: "Ingreso registrado",
      description: "Barba + Gel x2 · $\u00a015.000",
      time: "Hace 12 min",
    });
  });

  it("describes the latest persisted customer and its relative time", () => {
    expect(buildCustomerActivity(customer, now)).toEqual({
      id: customer.id,
      type: "customer",
      title: "Nuevo cliente",
      description: "Ana Pérez fue agregado a clientes",
      time: "Hace 1 h",
    });
  });

  it("uses an absolute short date after the first day", () => {
    expect(
      buildCustomerActivity(
        { ...customer, createdAt: "2026-08-09T12:00:00.000Z" },
        now,
      ).time,
    ).toBe("9/8");
  });

  it("does not fabricate activity when income or customer records are absent", () => {
    expect(buildIncomeActivity(null, now)).toMatchObject({
      type: "income",
      description: "Todavía no se registraron ingresos.",
      time: "Sin actividad",
    });
    expect(buildCustomerActivity(null, now)).toMatchObject({
      type: "customer",
      description: "Todavía no se registraron clientes.",
      time: "Sin actividad",
    });
  });
});
