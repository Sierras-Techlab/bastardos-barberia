import { describe, expect, it, vi } from "vitest";

import { render, screen } from "@testing-library/react";

import { IncomeForm } from "@/components/incomes/income-form";
import { CommissionPreview } from "@/components/incomes/commission-preview";
import type { IncomeClient } from "@/lib/incomes/client";
import type { IncomeFormData } from "@/types/income";

const employeeId = "00000000-0000-4000-8000-000000000003";
const serviceId = "00000000-0000-4000-8000-000000000004";
const paymentId = "60000000-0000-4000-8000-000000000005";

const employeeFormData: IncomeFormData = {
  viewer: "employee",
  currentUser: { id: employeeId, firstName: "Fer", lastName: "Pérez", role: "employee" },
  services: [{ id: serviceId, name: "Corte", price: 10000 }],
  products: [{ id: "00000000-0000-4000-8000-000000000006", name: "Cera", price: 5000, stock: 3 }],
  customers: [],
  paymentMethods: [{ id: paymentId, name: "Efectivo", isActive: true }],
  employees: [{ id: employeeId, firstName: "Fer", lastName: "Pérez", role: "employee", isActive: true, serviceCommissionRate: 50, productCommissionRate: 10 }],
};

const employeeFormValues = {
  employeeId,
  customerId: null,
  serviceId,
  products: [{ productId: "00000000-0000-4000-8000-000000000006", quantity: 1, grantFullCommission: true }],
  payments: [{ paymentMethodId: paymentId, amount: 15000 }],
  grantFullServiceCommission: true,
};

describe("020 application layer role safety", () => {
  it("hides the manager-only professional selector and renders the form for an employee", () => {
    const client: Pick<IncomeClient, "create"> = { create: vi.fn() };
    render(<IncomeForm data={employeeFormData} incomeClient={client} />);
    expect(screen.queryByRole("combobox", { name: /empleado responsable/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Corte/i })).toBeInTheDocument();
    expect(screen.getByText("Cera")).toBeInTheDocument();
  });

  it("employee preview shows only the user earning, no barbershop net", () => {
    render(<CommissionPreview values={employeeFormValues} data={employeeFormData} />);
    expect(screen.getByText("Tu ganancia")).toBeInTheDocument();
    expect(screen.queryByText(/neto barbería/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/precio de catálogo|total de la venta/i)).not.toBeInTheDocument();
  });
});

