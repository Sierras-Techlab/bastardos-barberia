import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import type { IncomeFormValues } from "@/lib/incomes/income-schema";
import type { IncomeFormData } from "@/types/income";
import { IncomeSummary } from "./income-summary";

const data: IncomeFormData = {
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
};

const values: IncomeFormValues = {
  employeeId: "employee-1",
  customerId: "customer-1",
  serviceId: "service-1",
  products: [{ productId: "product-1", quantity: 2 }],
  paymentMode: "transfer",
  payments: [{ method: "transfer", amount: 36000 }],
  grantFullServiceCommission: false,
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
