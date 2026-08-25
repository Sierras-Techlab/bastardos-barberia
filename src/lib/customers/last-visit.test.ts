import { describe, expect, it } from "vitest";

import { formatLastVisit, noLeakage } from "@/lib/customers/last-visit";
import type { Customer } from "@/types/customer";

const baseCustomer: Customer = {
  id: "00000000-0000-4000-8000-000000000001",
  firstName: "Juan",
  lastName: "Cruz",
  email: null,
  phone: "3515550200",
  visits: 0,
  createdAt: "2026-07-01T00:00:00.000Z",
  fixedSchedule: null,
  fixedScheduleVersion: null,
  lastVisitBusinessDate: null,
};

describe("formatLastVisit", () => {
  it("returns Sin visitas when the customer has no visits", () => {
    expect(formatLastVisit(null, "2026-08-15")).toEqual({ dateLabel: "Sin visitas", relativeLabel: null });
  });

  it("labels visits on the same day as hoy", () => {
    expect(formatLastVisit("2026-08-15", "2026-08-15").relativeLabel).toBe("hoy");
  });

  it("labels yesterday", () => {
    expect(formatLastVisit("2026-08-14", "2026-08-15").relativeLabel).toBe("ayer");
  });

  it("labels plural days", () => {
    expect(formatLastVisit("2026-08-12", "2026-08-15").relativeLabel).toBe("hace 3 días");
  });

  it("labels plural weeks", () => {
    expect(formatLastVisit("2026-07-25", "2026-08-15").relativeLabel).toMatch(/semanas/);
  });

  it("labels plural months", () => {
    expect(formatLastVisit("2025-12-15", "2026-08-15").relativeLabel).toMatch(/meses/);
  });

  it("labels future visits as próxima", () => {
    expect(formatLastVisit("2026-08-16", "2026-08-15").relativeLabel).toBe("próxima");
  });
});

describe("noLeakage", () => {
  it("accepts the public projection with lastVisitBusinessDate", () => {
    const customer: Customer = { ...baseCustomer, lastVisitBusinessDate: "2026-08-15" };
    expect(noLeakage(customer)).toBe(true);
  });

  it("rejects any sensitive key sneaking into the projection", () => {
    const leak = { ...baseCustomer, paymentMethod: { id: "x" } };
    expect(noLeakage(leak as Customer)).toBe(false);
  });
});