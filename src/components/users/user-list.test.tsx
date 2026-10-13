import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { SafeUser } from "@/lib/auth/types";
import type { ChairRentalPayment, EmployeeCommercialAgreement } from "@/types/chair-rental";
import { UserList } from "./user-list";

const employee: SafeUser = {
  id: "00000000-0000-4000-8000-000000000002",
  firstName: "Lucía",
  lastName: "Ferreyra",
  username: "lucia.ferreyra",
  role: { id: 3, name: "employee" },
  isActive: true,
  serviceCommissionRate: 45,
  productCommissionRate: 10,
  lastLoginAt: null,
  createdAt: "2026-08-08T12:00:00.000Z",
  updatedAt: "2026-08-08T12:00:00.000Z",
};

const agreement: EmployeeCommercialAgreement = {
  serviceCommissionEnabled: true,
  productCommissionEnabled: true,
  chairRentalEnabled: true,
  monthlyChairRentalAmount: 18000,
  chairRentalEffectiveFrom: "2026-10",
  chairRentalDueDay: 28,
};

const rental: ChairRentalPayment = {
  id: "rental-1",
  employeeId: employee.id,
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

describe("UserList rental column", () => {
  it("shows disabled employee commissions as inactive even when the base rate is preserved", () => {
    render(
      <UserList
        users={[employee]}
        currentUserId="owner"
        onAction={vi.fn()}
        agreements={{
          [employee.id]: {
            ...agreement,
            serviceCommissionEnabled: false,
            productCommissionEnabled: false,
          },
        }}
      />,
    );

    expect(screen.getAllByText("Sin comisión")).toHaveLength(2);
    expect(screen.queryByText("45%")).not.toBeInTheDocument();
    expect(screen.queryByText("10%")).not.toBeInTheDocument();
  });

  it("keeps the compact rental summary for mobile only", () => {
    render(
      <UserList
        users={[employee]}
        currentUserId="owner"
        onAction={vi.fn()}
        agreements={{ [employee.id]: agreement }}
        rentals={{ [employee.id]: rental }}
        canEditAgreement
      />,
    );

    expect(screen.getByText("Alquiler de octubre de 2026:").parentElement).toHaveClass("xl:hidden");
  });

  it("keeps the rental cell under the rental header instead of a commission column", () => {
    render(
      <UserList
        users={[employee]}
        currentUserId="owner"
        onAction={vi.fn()}
        agreements={{ [employee.id]: agreement }}
        rentals={{ [employee.id]: rental }}
        canEditAgreement
      />,
    );

    const row = screen.getAllByRole("row")[1];
    const cells = within(row).getAllByRole("cell");

    expect(cells[3]).toHaveTextContent("45%");
    expect(cells[4]).toHaveTextContent("10%");
    expect(cells[5]).toHaveTextContent("Período facturado: octubre de 2026");
  });
});
