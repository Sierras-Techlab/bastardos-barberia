import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import type { ManagerIncomeFormValues } from "@/lib/incomes/income-schema";
import type { IncomeFormData } from "@/types/income";
import { IncomeSummary } from "./income-summary";

const data: IncomeFormData = {
  viewer: "manager",
  currentUser: {
    id: "employee-1",
    firstName: "Lautaro",
    lastName: "Bastardos",
    role: "owner",
  },
  customers: [
    { id: "customer-1", firstName: "Tomás", lastName: "Pereyra" },
  ],
  services: [{ id: "service-1", name: "Corte", price: 16000 }],
  products: [
    { id: "product-1", name: "Pomada", price: 10000, stock: 5 },
  ],
  paymentMethods: [{ id: "60000000-0000-4000-8000-000000000002", name: "Transferencia", isActive: true }],
  employees: [],
};

const values: ManagerIncomeFormValues = {
  employeeId: "employee-1",
  customerId: "customer-1",
  serviceId: "service-1",
  products: [{ productId: "product-1", quantity: 2, grantFullCommission: false }],
  payments: [{ paymentMethodId: "60000000-0000-4000-8000-000000000002", amount: 36000 }],
  grantFullServiceCommission: false,
  servicePriceOverride: null,
  productPriceOverrides: [],
};

it("shows the itemized sale and its hand-calculated total", () => {
  render(<IncomeSummary values={values} data={data} />);

  expect(screen.getByText("Lautaro Bastardos")).toBeInTheDocument();
  expect(screen.getByText("Tomás Pereyra")).toBeInTheDocument();
  expect(screen.getByText("Corte")).toBeInTheDocument();
  expect(screen.getByText("Pomada × 2")).toBeInTheDocument();
  expect(screen.getByText("Transferencia")).toBeInTheDocument();
  expect(screen.getByText(/36\.000/)).toBeInTheDocument();
});

it("labels an entry without a customer", () => {
  render(
    <IncomeSummary values={{ ...values, customerId: null }} data={data} />,
  );

  expect(screen.getByText("Sin cliente asociado")).toBeInTheDocument();
});

it("shows charged line prices when a manager overrides catalog values", () => {
  render(<IncomeSummary values={{
    ...values,
    servicePriceOverride: { chargedUnitPrice: 12000, reason: "Amigo" },
    productPriceOverrides: [{
      productId: "product-1",
      override: { chargedUnitPrice: 8000, reason: "Amigo" },
    }],
  }} data={data} />);

  expect(screen.getByText(/12\.000/)).toBeInTheDocument();
  expect(screen.getByText(/16\.000/)).toBeInTheDocument();
  expect(screen.getByText(/28\.000/)).toBeInTheDocument();
});
