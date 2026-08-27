import { describe, expect, it } from "vitest";

import { compareMetric, describeComposition } from "./insights";

describe("compareMetric", () => {
  it("marks higher revenue as favorable", () => {
    expect(compareMetric(120, 100, "higher-is-better")).toEqual({
      difference: 20,
      percent: 20,
      tone: "favorable",
    });
  });

  it("marks lower expenses as favorable while preserving the signed change", () => {
    expect(compareMetric(80, 100, "lower-is-better")).toEqual({
      difference: -20,
      percent: -20,
      tone: "favorable",
    });
  });

  it("keeps commission changes neutral and avoids division by zero", () => {
    expect(compareMetric(120, 100, "neutral")).toEqual({ difference: 20, percent: 20, tone: "neutral" });
    expect(compareMetric(10, 0, "higher-is-better")).toEqual({ difference: 10, percent: null, tone: "neutral" });
  });

  it("rounds percentages against the absolute previous value", () => {
    expect(compareMetric(-50, -40, "higher-is-better")).toEqual({
      difference: -10,
      percent: -25,
      tone: "unfavorable",
    });
  });
});

describe("describeComposition", () => {
  it("describes the largest revenue source using a hand-checked share", () => {
    expect(describeComposition(
      [{ key: "services", amount: 68 }, { key: "products", amount: 22 }, { key: "subscriptions", amount: 10 }],
      "income",
    )).toBe("Los servicios representan el 68% de los ingresos.");
  });

  it("describes the largest expense type", () => {
    expect(describeComposition(
      [{ key: "fixed", amount: 60 }, { key: "variable", amount: 30 }, { key: "supplies", amount: 10 }],
      "expense",
    )).toBe("Los gastos fijos representan el 60% de los gastos.");
  });

  it("returns explicit empty copy when the total is zero", () => {
    expect(describeComposition([], "income")).toBe("Todavía no hay ingresos en este período.");
    expect(describeComposition([{ key: "fixed", amount: 0 }], "expense")).toBe("Todavía no hay gastos en este período.");
  });
});
