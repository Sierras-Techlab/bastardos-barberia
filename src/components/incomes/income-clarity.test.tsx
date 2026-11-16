import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { IncomeMetrics } from "./income-metrics";
import { CashSummaryCards } from "../cash/cash-summary-cards";
import type { CashSaleAuditItem } from "@/types/cash";

const composition = {
  sales: { grossTotal: 119500, commissionTotal: 56750, barbershopNet: 62750 },
  subscriptions: { grossTotal: 0, commissionTotal: 0, barbershopNet: 0 },
  chairRentals: { grossTotal: 16000, commissionTotal: 0, barbershopNet: 16000 },
};
const metrics = { grossTotal: 135500, commissionTotal: 56750, barbershopNet: 78750, count: 8, average: 14938, paymentTotals: [], composition };

it("explains how rentals contribute to collected income without creating commissions", () => {
  render(<IncomeMetrics metrics={metrics} />);
  expect(screen.getByText("Total cobrado")).toBeVisible();
  fireEvent.click(screen.getByText("De dónde viene lo cobrado"));
  const breakdown = screen.getByRole("region", { name: "De dónde viene lo cobrado" });
  const rentals = within(breakdown).getByText("Alquileres de silla").closest("li")!;
  expect(rentals).toHaveTextContent("16.000");
  expect(rentals).toHaveTextContent("Sin comisión");
  expect(screen.getByText(/El alquiler de silla se suma a los cobros y no genera comisión/)).toBeVisible();
  expect(screen.getByText(/no significa que ya se hayan pagado/)).toBeVisible();
});

it("does not invent a breakdown when the server has not returned one", () => {
  const { composition: omitted, ...oldMetrics } = metrics;
  void omitted;
  render(<IncomeMetrics metrics={oldMetrics} />);
  expect(screen.getByText("El desglose por concepto todavía no está disponible")).toBeVisible();
  expect(screen.queryByRole("region", { name: "De dónde viene lo cobrado" })).not.toBeInTheDocument();
});

it("keeps employee commission separate from the manager collection summary", () => {
  render(<IncomeMetrics role="employee" metrics={{ count: 8, employeeCommissionTotal: 56750 }} />);
  expect(screen.getByText("Tu comisión")).toBeVisible();
  expect(screen.queryByText("Para la barbería")).not.toBeInTheDocument();
  expect(screen.queryByText("Alquileres de silla")).not.toBeInTheDocument();
});

it("keeps post-close reversals out of the collection composition and excludes same-day voids", () => {
  const base: CashSaleAuditItem = { id: "1", createdAt: "2026-10-13T12:00:00Z", employee: { id: "u", firstName: "Milton", lastName: "Delich" }, customerName: null, kind: "combined", statusAtClose: "active", currentStatus: "active", grossTotal: 119500, commissionTotal: 56750, barbershopNet: 62750 };
  render(<CashSummaryCards sales={[
    base,
    { ...base, id: "2", kind: "chair_rental", currentStatus: "voided", grossTotal: 16000, commissionTotal: 0, barbershopNet: 16000 },
    { ...base, id: "3", kind: "subscription", statusAtClose: "voided", currentStatus: "voided", grossTotal: 9000 },
  ]} summary={{ salesGrossTotal: 135500, salesCommissionTotal: 56750, salesBarbershopNet: 78750, adjustmentGrossTotal: -16000, adjustmentCommissionTotal: 0, adjustmentBarbershopNet: -16000, grossTotal: 119500, commissionTotal: 56750, barbershopNet: 62750, serviceTotal: 112000, productTotal: 7500, saleCount: 3, activeSaleCount: 2, voidedSaleCount: 1, adjustmentCount: 1 }} />);
  const breakdown = screen.getByRole("region", { name: "De dónde viene lo cobrado" });
  expect(within(breakdown).getByText("Alquileres de silla").closest("li")).toHaveTextContent("16.000");
  expect(within(breakdown).getByText("Ventas de servicios y productos").closest("li")).toHaveTextContent("119.500");
  expect(within(breakdown).getByText("Mensualidades de clientes").closest("li")).toHaveTextContent("$ 0");
});
