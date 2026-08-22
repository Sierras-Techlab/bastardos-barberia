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
});