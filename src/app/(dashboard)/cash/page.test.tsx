import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/cash",
}));

const { requireManagerPage, getCashDay, listCashHistory, getBuenosAiresToday } =
  vi.hoisted(() => ({
    requireManagerPage: vi.fn(),
    getCashDay: vi.fn(),
    listCashHistory: vi.fn(),
    getBuenosAiresToday: vi.fn(),
  }));

vi.mock("@/lib/auth/authorization", () => ({ requireManagerPage }));
vi.mock("@/lib/cash/service", () => ({ getCashDay, listCashHistory }));
vi.mock("@/lib/cash/date", () => ({ getBuenosAiresToday }));
vi.mock("@/components/ui/sidebar", () => ({
  SidebarTrigger: () => <button type="button">Abrir navegación</button>,
}));

import CashPage, { metadata } from "./page";

const user = {
  id: "00000000-0000-4000-8000-000000000001",
  role: { id: 1, name: "owner" },
};
const emptyDay = {
  id: null,
  businessDate: "2026-08-15",
  state: "live",
  closedAt: null,
  lifecycle: {
    openingBalance: 0,
    openingSource: null,
    openedAt: null,
    openedBy: null,
    expectedCash: 0,
    countedCash: null,
    difference: null,
    closeMode: null,
    reconciliationState: "not_applicable",
  },
  summary: {
    salesGrossTotal: 0,
    salesCommissionTotal: 0,
    salesBarbershopNet: 0,
    adjustmentGrossTotal: 0,
    adjustmentCommissionTotal: 0,
    adjustmentBarbershopNet: 0,
    grossTotal: 0,
    commissionTotal: 0,
    barbershopNet: 0,
    serviceTotal: 0,
    productTotal: 0,
    saleCount: 0,
    activeSaleCount: 0,
    voidedSaleCount: 0,
    adjustmentCount: 0,
  },
  payments: [],
  sales: [],
  adjustments: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  requireManagerPage.mockResolvedValue({ user });
  getBuenosAiresToday.mockReturnValue("2026-08-15");
  getCashDay.mockResolvedValue(emptyDay);
  listCashHistory.mockResolvedValue({
    items: [],
    pagination: { page: 1, pageSize: 12, total: 0, totalPages: 0 },
  });
});

it("revalidates manager access and loads live cash with history in parallel", async () => {
  render(await CashPage());

  expect(screen.getByRole("heading", { name: "Caja" })).toBeVisible();
  expect(screen.getByText("Caja de hoy")).toBeVisible();
  expect(requireManagerPage).toHaveBeenCalledOnce();
  expect(getCashDay).toHaveBeenCalledWith(user, "2026-08-15");
  expect(listCashHistory).toHaveBeenCalledWith(user, {
    page: 1,
    pageSize: 12,
  });
  expect(metadata.title).toBe("Caja");
});

it("does not query cash after manager authorization fails", async () => {
  requireManagerPage.mockRejectedValueOnce(new Error("forbidden"));

  await expect(CashPage()).rejects.toThrow("forbidden");
  expect(getCashDay).not.toHaveBeenCalled();
  expect(listCashHistory).not.toHaveBeenCalled();
});
