import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

import { SidebarProvider } from "@/components/ui/sidebar";
import { getBuenosAiresSevenDayRange } from "@/lib/dashboard/income-summary";

const { getLatestCustomer, listIncomes, requirePageUser } = vi.hoisted(() => ({
  getLatestCustomer: vi.fn(),
  listIncomes: vi.fn(),
  requirePageUser: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({ requirePageUser }));
vi.mock("@/lib/customers/service", () => ({ getLatestCustomer }));
vi.mock("@/lib/incomes/service", () => ({ listIncomes }));

import Home from "./page";

const user = {
  id: "00000000-0000-4000-8000-000000000001",
  firstName: "Lautaro",
  lastName: "Bastardos",
  username: "lautaro.bastardos",
  role: { id: 1, name: "owner" },
  isActive: true,
  lastLoginAt: null,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};
const currentRange = getBuenosAiresSevenDayRange();
const incomePage = {
  items: [{
    id: "20000000-0000-4000-8000-000000000001",
    createdAt: new Date().toISOString(),
    businessDate: currentRange.dateTo,
    employee: { id: user.id, firstName: user.firstName, lastName: user.lastName },
    customer: null,
    service: { id: "30000000-0000-4000-8000-000000000001", name: "Corte real", price: 16000 },
    products: [],
    paymentMethod: "cash",
    total: 16000,
    status: "active",
  }],
  metrics: { total: 16000, count: 1, average: 16000, cashTotal: 16000, transferTotal: 0 },
  pagination: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
};
const renderHome = async () => render(<SidebarProvider>{await Home()}</SidebarProvider>);

beforeEach(() => {
  vi.clearAllMocks();
  requirePageUser.mockResolvedValue({ user });
  listIncomes.mockResolvedValue(incomePage);
  getLatestCustomer.mockResolvedValue(null);
});

it("revalidates the session and requests only the role-scoped seven-day income window", async () => {
  await renderHome();
  expect(requirePageUser).toHaveBeenCalledOnce();
  expect(listIncomes).toHaveBeenCalledWith(user, {
    dateFrom: currentRange.dateFrom,
    dateTo: currentRange.dateTo,
    status: "active",
    page: 1,
    pageSize: 100,
  });
});

it("renders only the three approved dashboard blocks", async () => {
  await renderHome();
  expect(screen.getByRole("heading", { name: "Ingresos de hoy" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Acciones rápidas" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Clientes fijos" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Acciones rápidas" }).closest("section")?.parentElement).toHaveClass("md:grid-cols-2", "xl:grid-cols-1");
  expect(screen.queryByText("Servicios destacados")).not.toBeInTheDocument();
  expect(screen.queryByText("Actividad reciente")).not.toBeInTheDocument();
});

it("uses a spaced twelve-column desktop layout with constrained children", async () => {
  await renderHome();
  const dashboardGrid = screen.getByTestId("dashboard-grid");
  expect(dashboardGrid).toHaveClass("gap-5", "xl:grid-cols-12");
  expect(screen.getByRole("heading", { name: "Ingresos de hoy" }).closest("section")?.parentElement).toHaveClass("min-w-0", "xl:col-span-8");
  expect(screen.getByRole("heading", { name: "Acciones rápidas" }).closest("section")?.parentElement).toHaveClass("min-w-0", "gap-5", "xl:col-span-4");
});

it("keeps employee dashboard data scoped by the server service", async () => {
  requirePageUser.mockResolvedValueOnce({ user: { ...user, role: { id: 3, name: "employee" } } });
  await renderHome();
  expect(screen.getByRole("heading", { name: "Tus ingresos de hoy" })).toBeVisible();
  expect(listIncomes.mock.calls[0]?.[1]).not.toHaveProperty("userId");
});

it("loads every result page before deriving the seven-day summary", async () => {
  listIncomes
    .mockResolvedValueOnce({ ...incomePage, pagination: { page: 1, pageSize: 100, total: 101, totalPages: 2 } })
    .mockResolvedValueOnce({
      ...incomePage,
      items: [{ ...incomePage.items[0], id: "20000000-0000-4000-8000-000000000002", total: 19000, paymentMethod: "transfer" }],
      pagination: { page: 2, pageSize: 100, total: 101, totalPages: 2 },
    });
  await renderHome();
  expect(listIncomes).toHaveBeenNthCalledWith(2, user, expect.objectContaining({ page: 2, pageSize: 100 }));
  expect(screen.getByText("$ 35.000")).toBeVisible();
  expect(screen.getByText("2 ventas")).toBeVisible();
});

it("does not render the dashboard after session revocation", async () => {
  requirePageUser.mockRejectedValueOnce(new Error("revoked session"));
  await expect(Home()).rejects.toThrow("revoked session");
  expect(listIncomes).not.toHaveBeenCalled();
});
