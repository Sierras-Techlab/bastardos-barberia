import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { ReportComposition } from "./report-composition";

it("explains income, payment and expense composition with semantic bars", () => {
  render(<ReportComposition
    income={[{ key: "services", amount: 68 }, { key: "products", amount: 22 }, { key: "subscriptions", amount: 10 }]}
    payments={[{ id: "cash", name: "Efectivo", amount: 100 }]}
    expenses={[{ key: "fixed", amount: 60 }, { key: "variable", amount: 30 }, { key: "supplies", amount: 10 }]}
  />);
  expect(screen.getByText("Los servicios representan el 68% de los ingresos.")).toBeVisible();
  expect(screen.getByText("Efectivo")).toBeVisible();
  expect(screen.getAllByRole("meter").length).toBeGreaterThan(3);
});

it("uses singular labels for one rental payment", () => {
  render(<ReportComposition
    income={[]}
    payments={[]}
    expenses={[]}
    chairRentals={{
      total: 18000,
      count: 1,
      byEffectiveDate: [{ date: "2026-10-05", amount: 18000, count: 1 }],
      payingEmployees: [{ employeeId: "employee-1", employeeName: "Lucía Ferreyra", amount: 18000, paymentCount: 1 }],
      pending: [],
      overdue: [],
    }}
  />);

  expect(screen.getByText("1 pago efectivo")).toBeVisible();
  expect(screen.getByText(/1 pago$/)).toBeVisible();
});
