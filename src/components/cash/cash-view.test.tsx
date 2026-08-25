import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/cash",
}));

import { CashView } from "@/components/cash/cash-view";
import type { CashDay, PaginatedCashHistory } from "@/types/cash";

const id = "00000000-0000-4000-8000-000000000001";
const incomeId = "20000000-0000-4000-8000-000000000001";
const summary = {
  salesGrossTotal: 31000,
  salesCommissionTotal: 7200,
  salesBarbershopNet: 23800,
  adjustmentGrossTotal: 0,
  adjustmentCommissionTotal: 0,
  adjustmentBarbershopNet: 0,
  grossTotal: 31000,
  commissionTotal: 7200,
  barbershopNet: 23800,
  serviceTotal: 16000,
  productTotal: 15000,
  saleCount: 1,
  activeSaleCount: 1,
  voidedSaleCount: 0,
  adjustmentCount: 0,
};
const liveDay: CashDay = {
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
  summary,
  payments: [
    {
      paymentMethodId: id,
      name: "Efectivo",
      salesAmount: 31000,
      adjustmentAmount: 0,
      netAmount: 31000,
    },
  ],
  sales: [
    {
      id: incomeId,
      createdAt: "2026-08-15T15:00:00.000Z",
      employee: { id, firstName: "Uriel", lastName: "Alessandro" },
      customerName: "Pedro Castañeda",
      kind: "combined",
      statusAtClose: "active",
      currentStatus: "active",
      grossTotal: 31000,
      commissionTotal: 7200,
      barbershopNet: 23800,
    },
  ],
  adjustments: [],
};
const history: PaginatedCashHistory = {
  items: [
    {
      id,
      businessDate: "2026-08-14",
      state: "closed",
      closedAt: "2026-08-15T03:00:00.000Z",
      lifecycle: liveDay.lifecycle,
      summary,
    },
  ],
  pagination: { page: 1, pageSize: 12, total: 1, totalPages: 1 },
};

describe("CashView", () => {
  it("shows today's economics, dynamic payments and both audit tables", () => {
    render(
      <CashView
        initialDay={liveDay}
        initialHistory={history}
        viewerRole="owner"
      />,
    );

    expect(screen.getByText("Caja de hoy")).toBeVisible();
    expect(screen.getByText("Sin abrir")).toBeVisible();
    expect(screen.getByText(/Aún no abriste la caja de hoy\. Definí el saldo inicial físico/)).toBeVisible();
    expect(screen.getByText("—")).toBeVisible();
    expect(screen.getByText("Efectivo")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Cargar ingreso" }),
    ).toHaveAttribute("href", "/incomes/new");
    expect(
      screen.getByRole("table", { name: "Ventas de la caja" }),
    ).toBeVisible();
    expect(
      screen.getByRole("table", { name: "Historial de cajas" }),
    ).toBeVisible();
  });

  it("aligns the payment breakdown with the sales table on desktop", () => {
    render(
      <CashView
        initialDay={liveDay}
        initialHistory={history}
        viewerRole="owner"
      />,
    );

    const paymentCard = screen
      .getByText("Medios de pago")
      .closest('[data-slot="card"]');

    expect(paymentCard?.parentElement).toHaveClass("cash-payment-column");
  });

  it("stops offering another opening after the server returns the open register", async () => {
    const browser = userEvent.setup();
    const openedDay: CashDay = {
      ...liveDay,
      id,
      lifecycle: {
        ...liveDay.lifecycle,
        openingBalance: 100,
        openingSource: "manual",
        openedAt: "2026-08-15T12:00:00.000Z",
        openedBy: { id, firstName: "Uriel", lastName: "Alessandro" },
        expectedCash: 100,
      },
    };
    const cashClient = {
      getDay: vi.fn(),
      list: vi.fn(),
      open: vi.fn().mockResolvedValue(openedDay),
      close: vi.fn(),
      confirm: vi.fn(),
    };

    render(<CashView initialDay={liveDay} initialHistory={history} viewerRole="owner" cashClient={cashClient} />);
    await browser.click(screen.getByRole("button", { name: "Abrir caja" }));
    await browser.click(screen.getByRole("button", { name: /^Abrir caja \(/ }));

    expect(await screen.findByText("En curso")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Abrir caja" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cerrar caja" })).toBeVisible();
  });

  it("loads a selected historical closure without mutating it", async () => {
    const browser = userEvent.setup();
    const closedDay = {
      ...liveDay,
      id,
      businessDate: "2026-08-14",
      state: "closed" as const,
      closedAt: "2026-08-15T03:00:00.000Z",
      lifecycle: {
        openingBalance: 0,
        openingSource: "first_income" as const,
        openedAt: "2026-08-14T12:00:00.000Z",
        openedBy: { id, firstName: "Uriel", lastName: "Alessandro" },
        expectedCash: 31000,
        countedCash: 31000,
        difference: 0,
        closeMode: "automatic" as const,
        reconciliationState: "confirmed" as const,
      },
    };
    const cashClient = {
      getDay: vi.fn().mockResolvedValue(closedDay),
      list: vi.fn(),
      open: vi.fn(),
      close: vi.fn(),
      confirm: vi.fn(),
    };

    render(
      <CashView
        initialDay={liveDay}
        initialHistory={history}
        viewerRole="owner"
        cashClient={cashClient}
      />,
    );
    await browser.click(
      screen.getByRole("button", { name: "Ver caja del 14/08/2026" }),
    );

    expect(cashClient.getDay).toHaveBeenCalledWith("2026-08-14");
    expect(await screen.findByText("Caja cerrada")).toBeVisible();
    expect(screen.queryByText("Abrir caja")).not.toBeInTheDocument();
    expect(screen.queryByText("Cerrar caja")).not.toBeInTheDocument();

    await browser.click(screen.getByRole("button", { name: "Volver a hoy" }));
    expect(cashClient.getDay).toHaveBeenLastCalledWith("2026-08-15");
    expect(cashClient.getDay).toHaveBeenCalledTimes(2);
  });
});
