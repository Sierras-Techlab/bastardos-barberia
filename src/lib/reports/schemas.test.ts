import { describe, expect, it } from "vitest";

import { businessReportSchema, reportMonthQuerySchema } from "./schemas";

export const reportFixture = {
  month: "2026-08",
  availableMonths: ["2026-08", "2026-06"],
  generatedAt: "2026-08-25T15:00:00.000Z",
  period: {
    from: "2026-08-01",
    to: "2026-08-25",
    elapsedDays: 25,
    daysInMonth: 31,
    isCurrentMonth: true,
  },
  comparison: {
    month: "2026-07",
    from: "2026-07-01",
    to: "2026-07-25",
  },
  summary: {
    grossIncome: 180_000,
    commission: 45_000,
    barbershopNet: 135_000,
    expenses: 150_000,
    operatingResult: -15_000,
    operatingMarginBps: -833,
  },
  previousSummary: {
    grossIncome: 150_000,
    commission: 37_500,
    barbershopNet: 112_500,
    expenses: 80_000,
    operatingResult: 32_500,
    operatingMarginBps: 2_167,
  },
  projection: {
    grossIncome: 223_200,
    commission: 55_800,
    barbershopNet: 167_400,
    expenses: 186_000,
    operatingResult: -18_600,
    operatingMarginBps: -833,
  },
  daily: [
    {
      day: 1,
      selected: { grossIncome: 20_000, expenses: 5_000, operatingResult: 10_000 },
      previous: { grossIncome: 18_000, expenses: 4_000, operatingResult: 9_500 },
    },
    {
      day: 25,
      selected: { grossIncome: 0, expenses: 40_000, operatingResult: -40_000 },
      previous: null,
    },
  ],
  incomeComposition: [
    { key: "services" as const, amount: 100_000 },
    { key: "products" as const, amount: 50_000 },
    { key: "subscriptions" as const, amount: 30_000 },
  ],
  paymentComposition: [
    {
      id: "60000000-0000-4000-8000-000000000001:cash",
      name: "Efectivo",
      amount: 180_000,
    },
  ],
  expenseComposition: [
    { key: "fixed" as const, amount: 100_000 },
    { key: "variable" as const, amount: 30_000 },
    { key: "supplies" as const, amount: 20_000 },
  ],
  serviceRanking: [
    {
      id: "30000000-0000-4000-8000-000000000001:corte",
      name: "Corte",
      amount: 100_000,
      quantity: 5,
    },
  ],
  productRanking: [
    {
      id: "50000000-0000-4000-8000-000000000001:cera",
      name: "Cera",
      amount: 50_000,
      quantity: 3,
    },
  ],
  highlights: {
    bestDay: { date: "2026-08-01", amount: 10_000 },
    worstDay: { date: "2026-08-25", amount: -40_000 },
  },
};

describe("businessReportSchema", () => {
  it("accepts the complete strict business report contract", () => {
    expect(businessReportSchema.parse(reportFixture)).toEqual(reportFixture);
  });

  it("rejects malformed or duplicate available months", () => {
    expect(() => businessReportSchema.parse({ ...reportFixture, availableMonths: ["2026-8"] })).toThrow();
    expect(() => businessReportSchema.parse({ ...reportFixture, availableMonths: ["2026-08", "2026-08"] })).toThrow();
  });

  it("rejects leaked fields and non-integer money", () => {
    expect(() => businessReportSchema.parse({ ...reportFixture, leakedEmployee: {} })).toThrow();
    expect(() => businessReportSchema.parse({
      ...reportFixture,
      summary: { ...reportFixture.summary, operatingResult: 10.5 },
    })).toThrow();
  });

  it("accepts large negative margins without an artificial percentage floor", () => {
    expect(businessReportSchema.parse({
      ...reportFixture,
      summary: { ...reportFixture.summary, operatingMarginBps: -2_500_000 },
    }).summary.operatingMarginBps).toBe(-2_500_000);
  });

  it("rejects unsafe integers and malformed enum keys", () => {
    expect(() => businessReportSchema.parse({
      ...reportFixture,
      summary: { ...reportFixture.summary, grossIncome: Number.MAX_SAFE_INTEGER + 1 },
    })).toThrow();
    expect(() => businessReportSchema.parse({
      ...reportFixture,
      incomeComposition: [{ key: "other", amount: 10 }],
    })).toThrow();
  });
});

describe("reportMonthQuerySchema", () => {
  it("accepts only canonical calendar months", () => {
    expect(reportMonthQuerySchema.parse({ month: "2026-08" })).toEqual({ month: "2026-08" });
    expect(() => reportMonthQuerySchema.parse({ month: "2026-8" })).toThrow();
    expect(() => reportMonthQuerySchema.parse({ month: "2026-13" })).toThrow();
    expect(() => reportMonthQuerySchema.parse({ month: "2026-08", actorId: crypto.randomUUID() })).toThrow();
  });
});
