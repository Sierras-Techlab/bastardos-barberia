import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import type { ReportTeamMember } from "@/types/report";
import { ReportTeamPerformance } from "./report-team-performance";

const metrics = {
  saleCount: 4, grossIncome: 80_000, commission: 24_000, barbershopNet: 56_000,
  averageTicket: 20_000, workedMinutes: 480, grossPerHour: 10_000,
  netPerHour: 7_000, outsideSessionSaleCount: 1,
};

const employee: ReportTeamMember = {
  id: "20000000-0000-4000-8000-000000000001", name: "Ana Barbera", role: "employee",
  current: metrics,
  previous: { ...metrics, saleCount: 2, grossIncome: 40_000, outsideSessionSaleCount: 0 },
};

it("explains employee production, attendance and comparison", () => {
  render(<ReportTeamPerformance members={[employee]} />);
  expect(screen.getByRole("heading", { name: "Rendimiento del equipo" })).toBeVisible();
  expect(screen.getByText("Ana Barbera")).toBeVisible();
  expect(screen.getByText("8 h trabajadas")).toBeVisible();
  expect(screen.getByText("1 venta fuera de jornada")).toBeVisible();
  expect(screen.getByText("+100% vs. período anterior")).toBeVisible();
  expect(screen.getByText("$ 20.000")).toBeVisible();
});

it("marks attendance as not applicable for owners and expands larger teams", async () => {
  const members = Array.from({ length: 6 }, (_, index) => ({
    ...employee,
    id: `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    name: `Profesional ${index + 1}`,
    role: index === 0 ? "owner" as const : "employee" as const,
    current: index === 0 ? { ...metrics, workedMinutes: null, grossPerHour: null, netPerHour: null, outsideSessionSaleCount: 0 } : metrics,
  }));
  render(<ReportTeamPerformance members={members} />);
  expect(screen.getByText("No aplica")).toBeVisible();
  expect(screen.queryByText("Profesional 6")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Ver todo el equipo" }));
  expect(screen.getByText("Profesional 6")).toBeVisible();
});

it("shows a useful empty state", () => {
  render(<ReportTeamPerformance members={[]} />);
  expect(screen.getByText("Todavía no hay actividad del equipo en este período.")).toBeVisible();
});
