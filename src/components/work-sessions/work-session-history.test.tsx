import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import type {
  EmployeeWorkSession,
  ManagerWorkSession,
} from "@/types/work-session";
import { WorkSessionHistory } from "./work-session-history";

const employeeSession: EmployeeWorkSession = {
  id: "70000000-0000-4000-8000-000000000001",
  employee: {
    id: "00000000-0000-4000-8000-000000000003",
    firstName: "Fernanda",
    lastName: "Pérez",
  },
  businessDate: "2026-08-21",
  startedAt: "2026-08-21T12:00:00.000Z",
  endedAt: "2026-08-21T20:00:00.000Z",
  state: "closed",
  metrics: { workedMinutes: 480, saleCount: 3, employeeCommission: 18000 },
};

const managerSession: ManagerWorkSession = {
  ...employeeSession,
  metrics: {
    ...employeeSession.metrics,
    grossTotal: 52000,
    barbershopNet: 34000,
  },
};

const pagination = { page: 1, pageSize: 12, total: 1, totalPages: 1 };

it("renders sanitized employee history without manager financial labels", () => {
  render(
    <WorkSessionHistory
      viewerRole="employee"
      initialData={{ items: [employeeSession], pagination }}
    />,
  );

  expect(screen.getAllByText("8 h").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Mi comisión").length).toBeGreaterThan(0);
  expect(screen.queryByText("Ventas brutas")).not.toBeInTheDocument();
  expect(screen.queryByText("Neto barbería")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /corregir jornada/i })).not.toBeInTheDocument();
});

it("shows manager gross and net metrics with employee filtering", async () => {
  const list = vi.fn().mockResolvedValue({ items: [managerSession], pagination });
  const browser = userEvent.setup();

  render(
    <WorkSessionHistory
      viewerRole="owner"
      initialData={{ items: [managerSession], pagination }}
      workSessionClient={{ list, correct: vi.fn() }}
    />,
  );

  expect(screen.getByText("Ventas brutas")).toBeVisible();
  expect(screen.getByText("Neto barbería")).toBeVisible();
  expect(screen.getAllByText(/52\.000/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/34\.000/).length).toBeGreaterThan(0);

  await browser.selectOptions(
    screen.getByRole("combobox", { name: "Filtrar por empleado" }),
    employeeSession.employee.id,
  );

  expect(list).toHaveBeenCalledWith({
    employeeId: employeeSession.employee.id,
    dateFrom: undefined,
    dateTo: undefined,
    page: 1,
    pageSize: 12,
  });
});
