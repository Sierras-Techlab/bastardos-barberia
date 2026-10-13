import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ChairRentalPayment } from "@/types/chair-rental";
import { ChairRentalHistorySheet } from "./chair-rental-history-sheet";

const voidedPayment: ChairRentalPayment = {
  id: "rental-voided",
  employeeId: "employee-1",
  employeeName: "Lucía Ferreyra",
  period: "2026-10",
  amount: 18000,
  status: "voided",
  paymentMethodId: "cash",
  paymentMethodName: "Efectivo",
    confirmedBy: { id: "owner-1", firstName: "Ana", lastName: "García" },
  paidAt: "2026-10-05T18:30:00.000Z",
  businessDate: "2026-10-05",
  incomeId: "income-1",
  voidedAt: "2026-10-06T12:45:00.000Z",
    voidedBy: { id: "owner-1", firstName: "Ana", lastName: "García" },
  voidReason: "Se registró dos veces",
};

describe("ChairRentalHistorySheet", () => {
  it("shows complete audit metadata for a voided payment", () => {
    render(
      <ChairRentalHistorySheet
        employeeName="Lucía Ferreyra"
        items={[voidedPayment]}
        open
        owner
        onClose={vi.fn()}
        onVoid={vi.fn()}
      />,
    );

    expect(screen.getByText(/Fecha de cobro:/)).toBeVisible();
    expect(screen.getByText(/Fecha de anulación:/)).toBeVisible();
    expect(screen.getByText(/Se registró dos veces/)).toBeVisible();
    expect(screen.getAllByText(/Ana García/)).toHaveLength(2);
    expect(screen.getByText(/Efectivo/)).toBeVisible();
    expect(screen.getByText(/18\.000/)).toBeVisible();
  });
});
