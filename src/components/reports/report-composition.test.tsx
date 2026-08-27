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
