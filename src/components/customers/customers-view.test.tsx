import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/customers",
}));

import { CustomersView } from "@/components/customers/customers-view";
import type { Customer } from "@/types/customer";

const baseCustomer: Customer = {
  id: "00000000-0000-4000-8000-000000000001",
  firstName: "Juan",
  lastName: "Cruz",
  email: null,
  phone: "3515550200",
  visits: 0,
  createdAt: "2026-07-01T00:00:00.000Z",
  fixedSchedule: null,
  fixedScheduleVersion: null,
  lastVisitBusinessDate: null,
};

const visitedCustomer: Customer = {
  ...baseCustomer,
  id: "00000000-0000-4000-8000-000000000002",
  firstName: "Ana",
  lastName: "Diaz",
  visits: 4,
  lastVisitBusinessDate: "2026-08-13",
};
const professional = { id: "00000000-0000-4000-8000-000000000099", firstName: "Lauti", lastName: "Bastardos" };
const fixedCustomer: Customer = {
  ...baseCustomer,
  fixedSchedule: { weekday: 2, time: "10:00", responsibleProfessional: professional, monthlyPrice: 15000 },
  fixedScheduleVersion: 1,
};

describe("CustomersView last visit column", () => {
  it("renders Sin visitas when the customer has never visited", () => {
    render(
      <CustomersView
        data={{ customers: [baseCustomer] }}
        canDelete={false}
        currentUserId="00000000-0000-4000-8000-000000000099"
        currentUserRole="owner"
        today="2026-08-15"
      />,
    );
    expect(screen.getByText("Sin visitas")).toBeVisible();
  });

  it("renders the date and relative label for a known visit", () => {
    render(
      <CustomersView
        data={{ customers: [visitedCustomer] }}
        canDelete={false}
        currentUserId="00000000-0000-4000-8000-000000000099"
        currentUserRole="owner"
        today="2026-08-15"
      />,
    );
    expect(screen.getByText("hace 2 días")).toBeVisible();
  });

  it("shows the persisted current month as paid instead of offering another charge", () => {
    render(<CustomersView
      data={{ customers: [fixedCustomer] }}
      canDelete
      currentUserId={professional.id}
      currentUserRole="owner"
      today="2026-08-15"
      onOpenFixedPayment={vi.fn()}
      fixedCustomerMonths={[{
        viewer: "manager",
        customer: { id: fixedCustomer.id, firstName: fixedCustomer.firstName, lastName: fixedCustomer.lastName },
        responsibleProfessional: professional,
        period: "2026-08",
        status: "paid",
        paidAt: "2026-08-15T12:00:00.000Z",
        incomeId: "00000000-0000-4000-8000-000000000010",
        employeeEarning: 7500,
        monthlyPrice: 15000,
      }]}
    />);

    expect(screen.getAllByRole("button", { name: /mensualidad cobrada de juan cruz/i })[0]).toBeDisabled();
    expect(screen.queryByRole("button", { name: /cobrar mensualidad de juan cruz/i })).not.toBeInTheDocument();
  });
});
