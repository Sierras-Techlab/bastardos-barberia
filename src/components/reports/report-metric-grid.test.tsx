import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { ReportMetricGrid } from "./report-metric-grid";

const current = { grossIncome: 120, commission: 30, barbershopNet: 90, expenses: 40, operatingResult: 50, operatingMarginBps: 4167 };
const previous = { grossIncome: 100, commission: 20, barbershopNet: 80, expenses: 50, operatingResult: 30, operatingMarginBps: 3000 };

it("shows all six metrics and metric-aware comparisons", () => {
  render(<ReportMetricGrid current={current} previous={previous} />);
  for (const label of ["Ingresos", "Comisiones", "Neto barbería", "Gastos", "Resultado", "Margen operativo"]) expect(screen.getByText(label)).toBeVisible();
  expect(screen.getByTestId("metric-expenses")).toHaveAttribute("data-tone", "favorable");
  expect(screen.getByTestId("metric-commission")).toHaveAttribute("data-tone", "neutral");
});
