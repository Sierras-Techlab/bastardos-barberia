import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const { requirePageUser, listWorkSessions, listUsers } = vi.hoisted(() => ({
  requirePageUser: vi.fn(),
  listWorkSessions: vi.fn(),
  listUsers: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({ requirePageUser }));
vi.mock("@/lib/work-sessions/service", () => ({ listWorkSessions }));
vi.mock("@/lib/users/repository", () => ({ userRepository: { list: listUsers } }));
vi.mock("@/components/ui/sidebar", () => ({
  SidebarTrigger: () => <button type="button">Abrir navegación</button>,
}));

import WorkSessionsPage, { metadata } from "./page";

const employee = {
  id: "00000000-0000-4000-8000-000000000003",
  firstName: "Fernanda",
  lastName: "Pérez",
  username: "fernanda.perez",
  role: { id: 3 as const, name: "employee" as const },
  isActive: true,
  serviceCommissionRate: 40,
  productCommissionRate: 10,
  lastLoginAt: null,
  createdAt: "2026-08-01T12:00:00.000Z",
  updatedAt: "2026-08-01T12:00:00.000Z",
};

const employeePage = {
  items: [
    {
      id: "70000000-0000-4000-8000-000000000001",
      employee: { id: employee.id, firstName: "Fernanda", lastName: "Pérez" },
      businessDate: "2026-08-21",
      startedAt: "2026-08-21T12:00:00.000Z",
      endedAt: "2026-08-21T20:00:00.000Z",
      state: "closed" as const,
      metrics: { workedMinutes: 480, saleCount: 3, employeeCommission: 18000 },
    },
  ],
  pagination: { page: 1, pageSize: 12, total: 1, totalPages: 1 },
};

const owner = {
  ...employee,
  id: "00000000-0000-4000-8000-000000000001",
  firstName: "Ana",
  lastName: "García",
  username: "ana.garcia",
  role: { id: 1 as const, name: "owner" as const },
};

const managerPage = {
  items: [
    {
      ...employeePage.items[0],
      metrics: {
        ...employeePage.items[0].metrics,
        grossTotal: 52000,
        barbershopNet: 34000,
      },
    },
  ],
  pagination: employeePage.pagination,
};

const employeeWithoutSession = {
  ...employee,
  id: "00000000-0000-4000-8000-000000000004",
  firstName: "Martín",
  lastName: "Sosa",
  username: "martin.sosa",
};

const inactiveEmployeeWithoutSession = {
  ...employee,
  id: "00000000-0000-4000-8000-000000000005",
  firstName: "Lucía",
  lastName: "Ramos",
  username: "lucia.ramos",
  isActive: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  requirePageUser.mockResolvedValue({ user: employee });
  listWorkSessions.mockResolvedValue(employeePage);
  listUsers.mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 100,
    total: 0,
    totalPages: 0,
  });
});

it("server-loads the employee sanitized presentism history", async () => {
  render(await WorkSessionsPage());

  expect(screen.getByRole("heading", { name: "Presentismo" })).toBeVisible();
  expect(screen.getByText("Mi jornada")).toBeVisible();
  expect(screen.queryByText("Jornadas del equipo")).not.toBeInTheDocument();
  expect(screen.getAllByText("Mi comisión").length).toBeGreaterThan(0);
  expect(screen.queryByText("Ventas brutas")).not.toBeInTheDocument();
  expect(listWorkSessions).toHaveBeenCalledWith(employee, {
    page: 1,
    pageSize: 12,
  });
  expect(metadata.title).toBe("Presentismo");
  expect(listUsers).not.toHaveBeenCalled();
});

it("loads every active and inactive non-deleted employee as manager filter options", async () => {
  requirePageUser.mockResolvedValueOnce({ user: owner });
  listWorkSessions.mockResolvedValueOnce(managerPage);
  listUsers
    .mockResolvedValueOnce({
      items: [employeeWithoutSession],
      page: 1,
      pageSize: 100,
      total: 101,
      totalPages: 2,
    })
    .mockResolvedValueOnce({
      items: [inactiveEmployeeWithoutSession],
      page: 2,
      pageSize: 100,
      total: 101,
      totalPages: 2,
    });

  render(await WorkSessionsPage());

  expect(screen.getByRole("option", { name: "Martín Sosa" })).toBeInTheDocument();
  expect(screen.getByRole("option", { name: "Lucía Ramos" })).toBeInTheDocument();
  expect(
    screen
      .getAllByRole("option")
      .map((option) => option.textContent),
  ).toEqual(["Todos los empleados", "Lucía Ramos", "Martín Sosa"]);
  expect(listUsers).toHaveBeenNthCalledWith(1, {
    roleId: 3,
    status: "all",
    page: 1,
    pageSize: 100,
  });
  expect(listUsers).toHaveBeenNthCalledWith(2, {
    roleId: 3,
    status: "all",
    page: 2,
    pageSize: 100,
  });
  expect(screen.getByText("Jornadas del equipo")).toBeVisible();
});

it("does not query sessions after authorization fails", async () => {
  requirePageUser.mockRejectedValueOnce(new Error("revoked session"));

  await expect(WorkSessionsPage()).rejects.toThrow("revoked session");
  expect(listWorkSessions).not.toHaveBeenCalled();
  expect(listUsers).not.toHaveBeenCalled();
});
