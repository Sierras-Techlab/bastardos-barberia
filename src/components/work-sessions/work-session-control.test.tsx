import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import { DashboardToaster } from "@/components/ui/dashboard-toaster";
import type { EmployeeWorkSession } from "@/types/work-session";
import { WorkSessionControl } from "./work-session-control";

const openSession: EmployeeWorkSession = {
  id: "70000000-0000-4000-8000-000000000001",
  employee: {
    id: "00000000-0000-4000-8000-000000000003",
    firstName: "Fernanda",
    lastName: "Pérez",
  },
  businessDate: "2026-08-21",
  startedAt: "2026-08-21T10:00:00.000Z",
  endedAt: null,
  state: "open",
  metrics: { workedMinutes: 95, saleCount: 2, employeeCommission: 9000 },
};

afterEach(() => {
  vi.useRealTimers();
});
it("starts an employee session and changes the persistent action to clock-out", async () => {
  const start = vi.fn().mockResolvedValue(openSession);
  const browser = userEvent.setup();

  render(
    <>
      <WorkSessionControl
        initialSession={null}
        workSessionClient={{ start, end: vi.fn() }}
      />
      <DashboardToaster />
    </>,
  );

  await browser.click(screen.getByRole("button", { name: "Marcar entrada" }));

  expect(start).toHaveBeenCalledOnce();
  expect(screen.getByText("Jornada en curso")).toBeVisible();
  expect(screen.getByRole("button", { name: "Marcar salida" })).toBeVisible();
  expect(await screen.findByText("Entrada registrada correctamente.")).toBeVisible();
});

it("shows live elapsed time and persists clock-out", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-08-21T11:35:00.000Z"));
  const closedSession: EmployeeWorkSession = {
    ...openSession,
    endedAt: "2026-08-21T11:35:00.000Z",
    state: "closed",
  };
  const end = vi.fn().mockResolvedValue(closedSession);
  const browser = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

  render(
    <WorkSessionControl
      initialSession={openSession}
      workSessionClient={{ start: vi.fn(), end }}
    />,
  );

  expect(screen.getByText("1 h 35 min")).toBeVisible();
  await browser.click(screen.getByRole("button", { name: "Marcar salida" }));

  expect(end).toHaveBeenCalledOnce();
  expect(screen.getByText("Sin jornada abierta")).toBeVisible();
  expect(screen.getByRole("button", { name: "Marcar entrada" })).toBeVisible();
});
