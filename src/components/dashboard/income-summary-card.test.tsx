import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { IncomeSummaryCard } from "@/components/dashboard/income-summary-card";
import type { DashboardIncomeSummary } from "@/lib/dashboard/income-summary";

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

it("renders today's income metrics and accessible seven-day values", () => {
  const { container } = render(<IncomeSummaryCard summary={summary} isEmployee={false} />);
  const surface = container.querySelector("section");
  expect(surface).toHaveClass("rounded-3xl", "border", "border-black/5");
  expect(surface?.className).toMatch(/\bshadow-/);
  expect(screen.getByRole("heading", { name: "Ingresos de hoy" })).toBeVisible();
  expect(screen.getByText("$ 35.000")).toBeVisible();
  expect(screen.getByText("2 ventas")).toBeVisible();
  expect(screen.getByText("Efectivo $ 22.000")).toBeVisible();
  expect(screen.getByText("Transferencia $ 7.000")).toBeVisible();
  expect(screen.getByText("Tarjeta $ 6.000")).toBeVisible();
  expect(screen.getByLabelText("miércoles 12 de agosto: 2 ingresos, $ 35.000")).toBeVisible();
  expect(screen.getByRole("link", { name: "Ver ingresos" })).toHaveAttribute("href", "/incomes");
  expect(screen.getByText("Promedio por venta").closest("article")).toHaveClass("border", "border-black/5");
  expect(screen.getByText("Ingresos registrados")).toHaveClass("text-white");
});

it("uses personal copy for employees", () => {
  render(<IncomeSummaryCard summary={summary} isEmployee />);
  expect(screen.getByRole("heading", { name: "Tus ingresos de hoy" })).toBeVisible();
});

it("hides manager-only totals and payment breakdown for employees", () => {
  render(<IncomeSummaryCard summary={summary} isEmployee />);
  expect(screen.queryByText("Promedio por venta")).not.toBeInTheDocument();
  expect(screen.queryByText("Efectivo $ 22.000")).not.toBeInTheDocument();
  expect(screen.queryByText("Transferencia $ 7.000")).not.toBeInTheDocument();
  expect(screen.queryByText("Tarjeta $ 6.000")).not.toBeInTheDocument();
  expect(screen.getByText("$ 35.000")).toBeVisible();
  expect(screen.getByText("2 ventas")).toBeVisible();
});
