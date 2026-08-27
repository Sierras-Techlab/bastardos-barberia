import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { BusinessReport } from "@/types/report";
import { ReportsWorkspace } from "./reports-workspace";

const metrics = { grossIncome: 100, commission: 20, barbershopNet: 80, expenses: 30, operatingResult: 50, operatingMarginBps: 5000 };
const report = { month: "2026-08", availableMonths: ["2026-08", "2026-06"], generatedAt: "2026-08-25T12:00:00Z", period: { from: "2026-08-01", to: "2026-08-25", elapsedDays: 25, daysInMonth: 31, isCurrentMonth: true }, comparison: { month: "2026-07", from: "2026-07-01", to: "2026-07-25" }, summary: metrics, previousSummary: metrics, projection: metrics, daily: [], incomeComposition: [{ key: "services", amount: 100 }, { key: "products", amount: 0 }, { key: "subscriptions", amount: 0 }], paymentComposition: [], expenseComposition: [{ key: "fixed", amount: 30 }, { key: "variable", amount: 0 }, { key: "supplies", amount: 0 }], serviceRanking: [], productRanking: [], teamPerformance: [], highlights: { bestDay: null, worstDay: null } } as BusinessReport;

it("offers only months with activity and loads after selecting one", async () => {
  const client = { get: vi.fn().mockResolvedValue({ ...report, month: "2026-06" }) };
  render(<ReportsWorkspace initialReport={report} client={client} />);

  const selector = screen.getByRole("combobox", { name: "Mes del reporte" });
  expect(screen.getAllByRole("option")).toHaveLength(2);
  expect(screen.queryByRole("option", { name: /julio/i })).not.toBeInTheDocument();
  fireEvent.change(selector, { target: { value: "2026-06" } });

  expect(await screen.findByRole("combobox", { name: "Mes del reporte" })).toHaveValue("2026-06");
  expect(client.get).toHaveBeenCalledWith("2026-06");
});

it("keeps the last report visible when changing month fails", async () => {
  const client = { get: vi.fn().mockRejectedValue(new Error("falló")) };
  render(<ReportsWorkspace initialReport={report} client={client} />);
  fireEvent.change(screen.getByLabelText("Mes del reporte"), { target: { value: "2026-07" } });
  expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo cargar el reporte");
  expect(screen.getByLabelText("Mes del reporte")).toHaveValue("2026-08");
  expect(screen.getByText("Resultado operativo")).toBeVisible();
});
