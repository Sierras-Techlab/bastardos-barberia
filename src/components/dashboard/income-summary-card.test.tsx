import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";

import { IncomeSummaryCard } from "@/components/dashboard/income-summary-card";
import { SevenDayEvolution } from "@/components/dashboard/seven-day-evolution";
import type { DashboardIncomeSummary, EmployeeDashboardIncomeSummary } from "@/lib/dashboard/income-summary";

const summary: DashboardIncomeSummary = {
  today: {
    total: 35000, count: 2, average: 17500,
    paymentTotals: [
      { paymentMethodId: "cash", name: "Efectivo", amount: 22000 },
      { paymentMethodId: "qr", name: "QR Billetera", amount: 13000 },
      { paymentMethodId: "link", name: "Link de pago", amount: 0 },
    ],
  },
  series: [
    { date: "2026-11-06", label: "vie", total: 0, count: 0 },
    { date: "2026-11-07", label: "sáb", total: 16000, count: 1 },
    { date: "2026-11-08", label: "dom", total: 0, count: 0 },
    { date: "2026-11-09", label: "lun", total: 17000, count: 1 },
    { date: "2026-11-10", label: "mar", total: 13000, count: 1 },
    { date: "2026-11-11", label: "mié", total: 19000, count: 1 },
    { date: "2026-11-12", label: "jue", total: 35000, count: 2 },
  ],
};

it("puts the actual daily total with the four links and shows positive payment methods", () => {
  render(<IncomeSummaryCard summary={summary} />);
  const hero = screen.getByRole("region", { name: "Total de ingresos activos de hoy" });
  expect(within(hero).getByText("$ 35.000")).toBeVisible();
  expect(within(hero).getByRole("navigation", { name: "Accesos directos" })).toBeVisible();
  expect(within(hero).getByText("Cantidad de ingresos")).toBeVisible();
  expect(within(hero).getByText("$ 17.500")).toBeVisible();
  const methods = within(hero).getByRole("region", { name: "Totales por medio de pago" });
  expect(within(methods).getByText("Efectivo").parentElement).toHaveTextContent("$ 22.000");
  expect(within(methods).getByText("QR Billetera").parentElement).toHaveTextContent("$ 13.000");
  expect(within(methods).queryByText("Link de pago")).not.toBeInTheDocument();
});

it("shows the employee commission and attributed income count with no manager breakdown", () => {
  const employeeSummary: EmployeeDashboardIncomeSummary = {
    viewer: "employee",
    today: { employeeCommission: 10000, count: 1 },
    series: summary.series.map((day) => ({ ...day, total: day.count > 0 ? 5000 : 0 })),
  };
  render(<IncomeSummaryCard summary={employeeSummary} />);
  expect(screen.getByRole("heading", { name: "Tu comisión generada hoy" })).toBeVisible();
  expect(screen.getByText("$ 10.000")).toBeVisible();
  expect(screen.getByText("Ingresos que te corresponden")).toBeVisible();
  expect(screen.getByText("ingreso hoy")).toBeInTheDocument();
  expect(screen.queryByText("Totales por medio de pago")).not.toBeInTheDocument();
  expect(screen.queryByText("Promedio por ingreso")).not.toBeInTheDocument();
});

it("shows seven abbreviated labels and expands the exact amount through a chart button", async () => {
  const browser = userEvent.setup();
  render(<SevenDayEvolution series={summary.series} employee={false} />);
  expect(screen.getByRole("region", { name: "Últimos 7 días" })).toBeVisible();
  expect(screen.getAllByRole("button")).toHaveLength(7);
  expect(screen.getByText("$35k")).toBeVisible();
  const thursday = screen.getByRole("button", { name: /jueves, 12 de noviembre.*35\.000/ });
  await browser.click(thursday);
  expect(thursday).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("status")).toHaveTextContent("$ 35.000");
  await browser.keyboard("{Enter}");
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

it("shows the empty weekly state without fictitious amounts", () => {
  render(<SevenDayEvolution series={summary.series.map((day) => ({ ...day, total: 0, count: 0 }))} employee />);
  expect(screen.getByText("Evolución de tus comisiones de los últimos 7 días")).toBeVisible();
  expect(screen.getByText("Sin movimientos en los últimos 7 días")).toBeVisible();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
