import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import type {
  EmployeeWorkSession,
  ManagerWorkSession,
  PaginatedManagerWorkSessions,
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

const secondEmployee = {
  id: "00000000-0000-4000-8000-000000000004",
  firstName: "Martín",
  lastName: "Sosa",
};

const employeeOptions = [employeeSession.employee, secondEmployee];

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

it("reconciles refreshed employee history from new server props", () => {
  const { rerender } = render(
    <WorkSessionHistory
      viewerRole="employee"
      initialData={{
        items: [],
        pagination: { ...pagination, total: 0, totalPages: 0 },
      }}
    />,
  );

  expect(screen.getByText("Todavía no hay jornadas")).toBeVisible();

  const openSession: EmployeeWorkSession = {
    ...employeeSession,
    endedAt: null,
    state: "open",
    metrics: { ...employeeSession.metrics, workedMinutes: 95 },
  };
  rerender(
    <WorkSessionHistory
      viewerRole="employee"
      initialData={{ items: [openSession], pagination }}
    />,
  );

  expect(screen.queryByText("Todavía no hay jornadas")).not.toBeInTheDocument();
  expect(screen.getAllByText("En curso").length).toBeGreaterThan(0);
  expect(screen.getAllByText("1 h 35 min").length).toBeGreaterThan(0);
});

it("shows manager gross and net metrics with employee filtering", async () => {
  const list = vi.fn().mockResolvedValue({ items: [managerSession], pagination });
  const browser = userEvent.setup();

  render(
    <WorkSessionHistory
      viewerRole="owner"
      initialData={{ items: [managerSession], pagination }}
      employeeOptions={employeeOptions}
      workSessionClient={{ list, correct: vi.fn() }}
    />,
  );

  expect(screen.getByText("Ventas brutas")).toBeVisible();
  expect(screen.getByText("Neto barbería")).toBeVisible();
  expect(screen.getByText("Página actual")).toBeVisible();
  expect(screen.getAllByText(/52\.000/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/34\.000/).length).toBeGreaterThan(0);
  expect(screen.getByRole("table", { name: "Historial de jornadas" })).toHaveClass(
    "min-w-[64rem]",
  );
  expect(screen.getByRole("table", { name: "Historial de jornadas" }).parentElement).toHaveClass(
    "overflow-x-auto",
  );

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

it("reloads the current filtered page after a correction changes membership", async () => {
  const filteredPage = { items: [managerSession], pagination };
  const emptyPage = {
    items: [],
    pagination: { ...pagination, total: 0, totalPages: 0 },
  };
  const list = vi
    .fn()
    .mockResolvedValueOnce(filteredPage)
    .mockResolvedValueOnce(emptyPage);
  const correct = vi.fn().mockResolvedValue({
    ...managerSession,
    businessDate: "2026-08-19",
  });
  const browser = userEvent.setup();

  render(
    <WorkSessionHistory
      viewerRole="owner"
      initialData={filteredPage}
      employeeOptions={employeeOptions}
      workSessionClient={{ list, correct }}
    />,
  );

  fireEvent.change(screen.getByLabelText("Desde"), {
    target: { value: "2026-08-21" },
  });
  fireEvent.change(screen.getByLabelText("Hasta"), {
    target: { value: "2026-08-21" },
  });
  await browser.click(screen.getByRole("button", { name: "Aplicar fechas" }));
  await waitFor(() => expect(list).toHaveBeenCalledTimes(1));

  await browser.click(
    screen.getAllByRole("button", { name: /corregir jornada de fernanda pérez/i })[0],
  );
  await browser.type(
    screen.getByLabelText("Motivo de la corrección"),
    "Horario informado por el empleado",
  );
  await browser.click(screen.getByRole("button", { name: "Guardar corrección" }));

  await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
  expect(list).toHaveBeenLastCalledWith({
    employeeId: undefined,
    dateFrom: "2026-08-21",
    dateTo: "2026-08-21",
    page: 1,
    pageSize: 12,
  });
  expect(screen.getByText("Todavía no hay jornadas")).toBeVisible();
  expect(screen.getByText("Ventas brutas").nextElementSibling).toHaveTextContent("$ 0");
});

it("falls back to the last valid page when correction contracts pagination", async () => {
  const pageTwo = {
    items: [managerSession],
    pagination: { page: 2, pageSize: 12, total: 13, totalPages: 2 },
  };
  const fallbackSession: ManagerWorkSession = {
    ...managerSession,
    id: "70000000-0000-4000-8000-000000000002",
    employee: secondEmployee,
  };
  const list = vi
    .fn()
    .mockResolvedValueOnce({
      items: [],
      pagination: { page: 2, pageSize: 12, total: 12, totalPages: 1 },
    })
    .mockResolvedValueOnce({
      items: [fallbackSession],
      pagination: { page: 1, pageSize: 12, total: 12, totalPages: 1 },
    });
  const correct = vi.fn().mockResolvedValue({
    ...managerSession,
    businessDate: "2026-08-19",
  });
  const browser = userEvent.setup();

  render(
    <WorkSessionHistory
      viewerRole="owner"
      initialData={pageTwo}
      employeeOptions={employeeOptions}
      workSessionClient={{ list, correct }}
    />,
  );

  await browser.click(
    screen.getAllByRole("button", { name: /corregir jornada de fernanda pérez/i })[0],
  );
  await browser.type(
    screen.getByLabelText("Motivo de la corrección"),
    "La jornada cambió de fecha",
  );
  await browser.click(screen.getByRole("button", { name: "Guardar corrección" }));

  await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
  expect(list).toHaveBeenNthCalledWith(1, {
    employeeId: undefined,
    dateFrom: undefined,
    dateTo: undefined,
    page: 2,
    pageSize: 12,
  });
  expect(list).toHaveBeenNthCalledWith(2, {
    employeeId: undefined,
    dateFrom: undefined,
    dateTo: undefined,
    page: 1,
    pageSize: 12,
  });
  expect(screen.getByText("Página 1 de 1")).toBeVisible();
  expect(screen.getAllByText("Martín Sosa").length).toBeGreaterThan(0);
});

it("keeps the newest filter response when requests finish out of order", async () => {
  let resolveFirst!: (value: PaginatedManagerWorkSessions) => void;
  let resolveSecond!: (value: PaginatedManagerWorkSessions) => void;
  const first = new Promise<PaginatedManagerWorkSessions>((resolve) => {
    resolveFirst = resolve;
  });
  const second = new Promise<PaginatedManagerWorkSessions>((resolve) => {
    resolveSecond = resolve;
  });
  const list = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
  const secondSession: ManagerWorkSession = {
    ...managerSession,
    id: "70000000-0000-4000-8000-000000000002",
    employee: secondEmployee,
    metrics: { ...managerSession.metrics, grossTotal: 17000, barbershopNet: 11000 },
  };
  const browser = userEvent.setup();

  render(
    <WorkSessionHistory
      viewerRole="owner"
      initialData={{ items: [managerSession], pagination }}
      employeeOptions={employeeOptions}
      workSessionClient={{ list, correct: vi.fn() }}
    />,
  );

  const filter = screen.getByRole("combobox", { name: "Filtrar por empleado" });
  await browser.selectOptions(filter, employeeSession.employee.id);
  await browser.selectOptions(filter, secondEmployee.id);

  await act(async () => {
    resolveSecond({ items: [secondSession], pagination });
  });
  await waitFor(() =>
    expect(within(screen.getByRole("table", { name: "Historial de jornadas" })).getByText("Martín Sosa")).toBeVisible(),
  );

  await act(async () => {
    resolveFirst({ items: [managerSession], pagination });
  });
  await waitFor(() => {
    const table = within(screen.getByRole("table", { name: "Historial de jornadas" }));
    expect(table.getByText("Martín Sosa")).toBeVisible();
    expect(table.queryByText("Fernanda Pérez")).not.toBeInTheDocument();
  });
});

it("marks manager metrics as page-only and updates them on pagination", async () => {
  const pageOne = {
    items: [managerSession],
    pagination: { page: 1, pageSize: 12, total: 2, totalPages: 2 },
  };
  const pageTwoSession: ManagerWorkSession = {
    ...managerSession,
    id: "70000000-0000-4000-8000-000000000002",
    employee: secondEmployee,
    metrics: { ...managerSession.metrics, grossTotal: 7000, barbershopNet: 5000 },
  };
  const list = vi.fn().mockResolvedValue({
    items: [pageTwoSession],
    pagination: { ...pageOne.pagination, page: 2 },
  });
  const browser = userEvent.setup();

  render(
    <WorkSessionHistory
      viewerRole="admin"
      initialData={pageOne}
      employeeOptions={employeeOptions}
      workSessionClient={{ list, correct: vi.fn() }}
    />,
  );

  expect(screen.getByText("Página actual")).toBeVisible();
  expect(screen.getByText(/totales.*esta página/i)).toBeVisible();
  await browser.click(screen.getByRole("button", { name: /siguiente/i }));

  await waitFor(() => {
    expect(screen.getAllByText(/7\.000/).length).toBeGreaterThan(0);
    expect(screen.getByText("Página 2 de 2")).toBeVisible();
  });
});
