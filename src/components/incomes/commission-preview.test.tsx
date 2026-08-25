import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { CommissionPreview } from "./commission-preview";
import type { ManagerIncomeFormValues } from "@/lib/incomes/income-schema";

const currentUser = { id: "00000000-0000-4000-8000-000000000001", firstName: "Lautaro", lastName: "Bastardos", role: "owner" as const };
const employee = { id: "00000000-0000-4000-8000-000000000002", firstName: "Fer", lastName: "Pérez", role: "employee" as const, isActive: true, serviceCommissionRate: 45, productCommissionRate: 10 };
const data = { viewer: "manager" as const, currentUser, employees: [employee], customers: [], services: [{ id: "service", name: "Corte", price: 16000 }], products: [{ id: "product", name: "Cera", price: 10000, stock: 2 }], paymentMethods: [{ id: "60000000-0000-4000-8000-000000000001", name: "Efectivo", isActive: true }] };
const baseValues: ManagerIncomeFormValues = { employeeId: employee.id, customerId: null, serviceId: "service", products: [{ productId: "product", quantity: 1, grantFullCommission: true }], payments: [{ paymentMethodId: "60000000-0000-4000-8000-000000000001", amount: 26000 }], grantFullServiceCommission: true, servicePriceOverride: null, productPriceOverrides: [] };
it("previews service and each product commission independently", () => { render(<CommissionPreview values={baseValues} data={data} onGrantFullServiceCommission={vi.fn()} />); const preview = screen.getByLabelText("Comisión estimada"); expect(preview).toHaveTextContent("Corte · 100%"); expect(preview).toHaveTextContent("Cera · 100%"); expect(preview).toHaveTextContent("$ 26.000"); expect(preview).toHaveTextContent("$ 0"); });
it("previews a full service alongside multiple independently commissioned products", () => {
  const shampoo = { id: "shampoo", name: "Shampoo", price: 10000, stock: 2 };
  render(<CommissionPreview
    values={{ ...baseValues, products: [
      { productId: "product", quantity: 2, grantFullCommission: true },
      { productId: "shampoo", quantity: 1, grantFullCommission: false },
    ] }}
    data={{ ...data, services: [{ ...data.services[0], price: 19000 }], products: [{ ...data.products[0], price: 15000 }, shampoo] }}
    onGrantFullServiceCommission={vi.fn()}
  />);

  const preview = screen.getByLabelText("Comisión estimada");
  expect(preview).toHaveTextContent("Corte · 100% · $ 19.000");
  expect(preview).toHaveTextContent("Cera · 100% · $ 30.000");
  expect(preview).toHaveTextContent("Shampoo · 10% · $ 1.000");
  expect(preview).toHaveTextContent("$ 50.000");
  expect(preview).toHaveTextContent("$ 9.000");
});
it("hides the exceptional grant for the employee role", () => { render(<CommissionPreview values={baseValues} data={{ ...data, currentUser: { ...currentUser, role: "employee" } }} onGrantFullServiceCommission={vi.fn()} />); expect(screen.queryByText(/Regalar el 100%/)).not.toBeInTheDocument(); });
it("applies the owner configured rates and never the 100 percent exception", () => {
  const responsibleOwner = { ...employee, id: "00000000-0000-4000-8000-000000000003", firstName: "Sofía", role: "owner" as const };

  render(<CommissionPreview values={{ ...baseValues, employeeId: responsibleOwner.id, grantFullServiceCommission: true }} data={{ ...data, employees: [responsibleOwner] }} onGrantFullServiceCommission={vi.fn()} />);

  const preview = screen.getByLabelText("Comisión estimada");
  expect(preview).toHaveTextContent("Corte · 45%");
  expect(preview).toHaveTextContent("Cera · 10%");
  expect(preview).not.toHaveTextContent("Corte · 100%");
  expect(screen.queryByText(/Regalar el 100%/)).not.toBeInTheDocument();
});
