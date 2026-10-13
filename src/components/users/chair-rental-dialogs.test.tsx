import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ChairRentalPayment } from "@/types/chair-rental";
import { ChairRentalConfirmDialog } from "./chair-rental-dialogs";

const payment: ChairRentalPayment = {
  id: "rental-1",
  employeeId: "employee-1",
  employeeName: "Lucía Ferreyra",
  period: "2026-10",
  amount: 18000,
  status: "pending",
  paymentMethodId: null,
  paymentMethodName: null,
  confirmedBy: null,
  paidAt: null,
  businessDate: null,
  incomeId: null,
  voidedAt: null,
  voidedBy: null,
  voidReason: null,
};

describe("ChairRentalConfirmDialog payment methods", () => {
  it("blocks confirmation while payment methods are loading", () => {
    render(
      <ChairRentalConfirmDialog
        payment={payment}
        methods={[]}
        methodsLoading
        open
        onClose={vi.fn()}
        onConfirm={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Cargando medios de pago");
    expect(screen.getByRole("button", { name: "Confirmar pago" })).toBeDisabled();
  });

  it("offers a retry when payment methods fail to load", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(
      <ChairRentalConfirmDialog
        payment={payment}
        methods={[]}
        methodsError="No pudimos cargar los medios de pago."
        onRetryMethods={onRetry}
        open
        onClose={vi.fn()}
        onConfirm={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos cargar los medios de pago.");
    await user.click(screen.getByRole("button", { name: "Reintentar medios de pago" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("explains when no active payment method exists", () => {
    render(
      <ChairRentalConfirmDialog
        payment={payment}
        methods={[]}
        open
        onClose={vi.fn()}
        onConfirm={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.getByText("No hay medios de pago activos configurados.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Confirmar pago" })).toBeDisabled();
  });
});
