import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const { requirePageUser, listWorkSessions } = vi.hoisted(() => ({
  requirePageUser: vi.fn(),
  listWorkSessions: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({ requirePageUser }));
vi.mock("@/lib/work-sessions/service", () => ({ listWorkSessions }));
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

beforeEach(() => {
  vi.clearAllMocks();
  requirePageUser.mockResolvedValue({ user: employee });
  listWorkSessions.mockResolvedValue(employeePage);
});

it("server-loads the employee sanitized presentism history", async () => {
  render(await WorkSessionsPage());

  expect(screen.getByRole("heading", { name: "Presentismo" })).toBeVisible();
  expect(screen.getAllByText("Mi comisión").length).toBeGreaterThan(0);
  expect(screen.queryByText("Ventas brutas")).not.toBeInTheDocument();
  expect(listWorkSessions).toHaveBeenCalledWith(employee, {
    page: 1,
    pageSize: 12,
  });
  expect(metadata.title).toBe("Presentismo");
});

it("does not query sessions after authorization fails", async () => {
  requirePageUser.mockRejectedValueOnce(new Error("revoked session"));

  await expect(WorkSessionsPage()).rejects.toThrow("revoked session");
  expect(listWorkSessions).not.toHaveBeenCalled();
});
