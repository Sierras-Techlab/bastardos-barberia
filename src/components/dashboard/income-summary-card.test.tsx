import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { IncomeSummaryCard } from "@/components/dashboard/income-summary-card";
import type { DashboardIncomeSummary, EmployeeDashboardIncomeSummary } from "@/lib/dashboard/income-summary";

const summary: DashboardIncomeSummary = {
  today: { total: 35000, count: 2, average: 17500, paymentTotals: [
    { paymentMethodId: "60000000-0000-4000-8000-000000000001", name: "Efectivo", amount: 22000 },
    { paymentMethodId: "60000000-0000-4000-8000-000000000002", name: "Transferencia", amount: 7000 },
    { paymentMethodId: "60000000-0000-4000-8000-000000000003", name: "Tarjeta", amount: 6000 },
  ] },
  series: [
    { date: "2026-08-06", label: "jue", total: 0, count: 0 },
    { date: "2026-08-07", label: "vie", total: 16000, count: 1 },
    { date: "2026-08-08", label: "sáb", total: 32000, count: 2 },
    { date: "2026-08-09", label: "dom", total: 0, count: 0 },
    { date: "2026-08-10", label: "lun", total: 13000, count: 1 },
    { date: "2026-08-11", label: "mar", total: 19000, count: 1 },
    { date: "2026-08-12", label: "mié", total: 35000, count: 2 },
  ],
};

const employeeSummary: EmployeeDashboardIncomeSummary = {
  viewer: "employee",
  today: { employeeCommission: 10000, count: 2 },
  series: summary.series.map((day) => ({ ...day, total: day.count > 0 ? 5000 : 0 })),
};

describe("IncomeSummaryCard", () => {
  it("renders today's income metrics and accessible seven-day values", () => {
    const { container } = render(<IncomeSummaryCard summary={summary} />);
    const surface = container.querySelector("section");
    expect(surface).toHaveClass("rounded-3xl", "border", "border-border", "bg-card");
    expect(surface?.className).toMatch(/\bshadow-/);
    expect(screen.getByRole("heading", { name: "Ingresos de hoy" })).toBeVisible();
    expect(screen.getByText("$ 35.000")).toBeVisible();
    expect(screen.getByText("2 ventas")).toBeVisible();
    expect(screen.getByText("Efectivo").parentElement).toHaveTextContent("$ 22.000");
    expect(screen.getByText("Transferencia").parentElement).toHaveTextContent("$ 7.000");
    expect(screen.getByText("Tarjeta").parentElement).toHaveTextContent("$ 6.000");
    const day = screen.getByLabelText(/miércoles 12 de agosto: 2 ventas/);
    expect(day).toBeVisible();
    expect(screen.getByText("Consultar importes por día")).toBeVisible();
    expect(screen.getByRole("link", { name: "Ver ingresos" })).toHaveAttribute("href", "/incomes");
    expect(screen.getByText("Promedio por venta").closest("article")).toHaveClass("border", "border-border");
    expect(screen.getByText("Ventas registradas")).not.toHaveClass("opacity-90");
  });

  it("exposes every day amount in a tap and keyboard friendly disclosure", async () => {
    const browser = userEvent.setup();
    render(<IncomeSummaryCard summary={summary} />);
    await browser.click(screen.getByText("Consultar importes por día"));
    expect(screen.getByText("miércoles 12 de agosto").parentElement).toHaveTextContent("2 ventas");
    expect(screen.getByText("miércoles 12 de agosto").parentElement).toHaveTextContent("$ 35.000");
  });

  it("uses personal copy for employees and never leaks the catalog total", () => {
    render(<IncomeSummaryCard summary={employeeSummary} />);
    expect(screen.getByRole("heading", { name: "Tus ingresos de hoy" })).toBeVisible();
    expect(screen.getByText("Comisión generada para vos")).toBeVisible();
    expect(screen.getByText("$ 10.000")).toBeVisible();
    expect(screen.queryByText("Efectivo $ 22.000")).not.toBeInTheDocument();
    expect(screen.queryByText("Transferencia $ 7.000")).not.toBeInTheDocument();
    expect(screen.queryByText("Tarjeta $ 6.000")).not.toBeInTheDocument();
    expect(screen.queryByText("Promedio por venta")).not.toBeInTheDocument();
    expect(screen.getByText("2 ingresos")).toBeVisible();
    expect(screen.getByLabelText(/miércoles 12 de agosto: 2 ingresos/)).toBeVisible();
    expect(screen.queryByText("Ventas que registraste")).not.toBeInTheDocument();
  });

  it("uses singular income wording for an employee with one entry", () => {
    const oneIncome: EmployeeDashboardIncomeSummary = {
      ...employeeSummary,
      today: { employeeCommission: 5000, count: 1 },
      series: employeeSummary.series.map((day, index) => index === 6 ? { ...day, count: 1 } : day),
    };
    render(<IncomeSummaryCard summary={oneIncome} />);
    expect(screen.getByText("1 ingreso")).toBeVisible();
    expect(screen.getByLabelText(/^miércoles 12 de agosto: 1 ingreso/)).toBeVisible();
  });
});
