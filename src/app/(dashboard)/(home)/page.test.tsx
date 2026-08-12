import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { SidebarProvider } from "@/components/ui/sidebar";

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
const latestIncome = {
  id: "20000000-0000-4000-8000-000000000001",
  createdAt: new Date().toISOString(),
  businessDate: "2026-08-11",
  employee: { id: user.id, firstName: user.firstName, lastName: user.lastName },
  customer: null,
  service: {
    id: "30000000-0000-4000-8000-000000000001",
    name: "Corte real",
    price: 14000,
  },
  products: [],
  paymentMethod: "cash",
  total: 14000,
  status: "active",
};
const latestCustomer = {
  id: "10000000-0000-4000-8000-000000000001",
  firstName: "Lucía",
  lastName: "Nueva",
  phone: "3515550101",
  email: null,
  visits: 0,
  createdAt: new Date().toISOString(),
};
const incomePage = {
  items: [latestIncome],
  metrics: {
    total: 14000,
    count: 1,
    average: 14000,
    cashTotal: 14000,
    transferTotal: 0,
  },
  pagination: { page: 1, pageSize: 1, total: 1, totalPages: 1 },
};
const renderHome = async () =>
  render(<SidebarProvider>{await Home()}</SidebarProvider>);

beforeEach(() => {
  vi.clearAllMocks();
  requirePageUser.mockResolvedValue({ user });
  listIncomes.mockResolvedValue(incomePage);
  getLatestCustomer.mockResolvedValue(latestCustomer);
});

it("revalidates the session and loads role-scoped recent activity", async () => {
  await renderHome();

  expect(requirePageUser).toHaveBeenCalledOnce();
  expect(listIncomes).toHaveBeenCalledWith(user, { page: 1, pageSize: 1 });
  expect(getLatestCustomer).toHaveBeenCalledWith(user);
});

it("renders the latest persisted income and customer instead of fixture activity", async () => {
  await renderHome();

  expect(screen.getByText(/Corte real/)).toHaveTextContent("$ 14.000");
  expect(screen.getByText("Lucía Nueva fue agregado a clientes")).toBeVisible();
  expect(screen.queryByText(/Tomás Pereyra/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Corte \+ barba y pomada/)).not.toBeInTheDocument();
});

it("renders honest activity slots when no income or customer exists", async () => {
  listIncomes.mockResolvedValueOnce({
    ...incomePage,
    items: [],
    metrics: {
      total: 0,
      count: 0,
      average: 0,
      cashTotal: 0,
      transferTotal: 0,
    },
    pagination: { page: 1, pageSize: 1, total: 0, totalPages: 0 },
  });
  getLatestCustomer.mockResolvedValueOnce(null);

  await renderHome();

  expect(screen.getByText("Todavía no se registraron ingresos.")).toBeVisible();
  expect(screen.getByText("Todavía no se registraron clientes.")).toBeVisible();
});

it("does not render the dashboard after session revocation", async () => {
  requirePageUser.mockRejectedValueOnce(new Error("revoked session"));

  await expect(Home()).rejects.toThrow("revoked session");
  expect(listIncomes).not.toHaveBeenCalled();
  expect(getLatestCustomer).not.toHaveBeenCalled();
});
