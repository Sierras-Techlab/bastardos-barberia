import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { ReportTrendChart } from "./report-trend-chart";

it("switches the accessible daily comparison metric", async () => {
  render(<ReportTrendChart selectedMonth="Agosto" previousMonth="Julio" daily={[{ day: 1, selected: { grossIncome: 100, expenses: 20, operatingResult: 80 }, previous: { grossIncome: 90, expenses: 30, operatingResult: 60 } }]} />);
  expect(screen.getByRole("img", { name: /evolución diaria del resultado/i })).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Ingresos" }));
  expect(screen.getByRole("img", { name: /evolución diaria de ingresos/i })).toBeVisible();
  expect(screen.getByText(/Agosto acumula/)).toBeVisible();
});
