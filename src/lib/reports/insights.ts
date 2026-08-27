import type { ExpenseBreakdownKey, IncomeBreakdownKey } from "@/types/report";

export type MetricDirection = "higher-is-better" | "lower-is-better" | "neutral";
export type MetricTone = "favorable" | "unfavorable" | "neutral";
export type MetricComparison = { difference: number; percent: number | null; tone: MetricTone };

export const compareMetric = (
  current: number,
  previous: number,
  direction: MetricDirection,
): MetricComparison => {
  const difference = current - previous;
  if (previous === 0 || difference === 0 || direction === "neutral") {
    return {
      difference,
      percent: previous === 0 ? null : Math.round((difference / Math.abs(previous)) * 100),
      tone: "neutral",
    };
  }
  const percent = Math.round((difference / Math.abs(previous)) * 100);
  const improves = direction === "higher-is-better" ? difference > 0 : difference < 0;
  return { difference, percent, tone: improves ? "favorable" : "unfavorable" };
};

const incomeLabels: Record<IncomeBreakdownKey, string> = {
  services: "Los servicios",
  products: "Los productos",
  subscriptions: "Las mensualidades",
};
const expenseLabels: Record<ExpenseBreakdownKey, string> = {
  fixed: "Los gastos fijos",
  variable: "Los gastos variables",
  supplies: "Los insumos",
};

export function describeComposition(
  entries: Array<{ key: IncomeBreakdownKey; amount: number }>,
  kind: "income",
): string;
export function describeComposition(
  entries: Array<{ key: ExpenseBreakdownKey; amount: number }>,
  kind: "expense",
): string;
export function describeComposition(
  entries: Array<{ key: IncomeBreakdownKey | ExpenseBreakdownKey; amount: number }>,
  kind: "income" | "expense",
) {
  const total = entries.reduce((sum, entry) => sum + entry.amount, 0);
  if (total === 0) return kind === "income"
    ? "Todavía no hay ingresos en este período."
    : "Todavía no hay gastos en este período.";

  const largest = [...entries].sort((a, b) => b.amount - a.amount || a.key.localeCompare(b.key))[0];
  const percentage = Math.round((largest.amount / total) * 100);
  const label = kind === "income"
    ? incomeLabels[largest.key as IncomeBreakdownKey]
    : expenseLabels[largest.key as ExpenseBreakdownKey];
  return `${label} representan el ${percentage}% de los ${kind === "income" ? "ingresos" : "gastos"}.`;
}
