import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { CommissionPreview } from "./commission-preview";

const currentUser = { id: "00000000-0000-4000-8000-000000000001", firstName: "Lautaro", lastName: "Bastardos", role: "owner" as const };
const employee = { id: "00000000-0000-4000-8000-000000000002", firstName: "Fer", lastName: "Pérez", role: "employee" as const, isActive: true, serviceCommissionRate: 45, productCommissionRate: 10 };
const data = { currentUser, employees: [employee], customers: [], services: [{ id: "service", name: "Corte", price: 16000 }], products: [{ id: "product", name: "Cera", price: 10000, stock: 2 }] };
const values = { employeeId: employee.id, customerId: null, serviceId: "service", products: [{ productId: "product", quantity: 1 }], paymentMode: "cash" as const, payments: [{ method: "cash" as const, amount: 26000 }], grantFullServiceCommission: false };
it("previews separate service and product rates", () => { render(<CommissionPreview values={values} data={data} onGrantFullServiceCommission={vi.fn()} />); expect(screen.getByText(/Servicio 45% · Productos 10%/)).toBeVisible(); expect(screen.getByText(/Regalar el 100%/)).toBeVisible(); });
it("hides the exceptional grant for the employee role", () => { render(<CommissionPreview values={values} data={{ ...data, currentUser: { ...currentUser, role: "employee" } }} onGrantFullServiceCommission={vi.fn()} />); expect(screen.queryByText(/Regalar el 100%/)).not.toBeInTheDocument(); });
it("neutralizes owner commission rates and overrides for the responsible employee", () => {
  const responsibleOwner = { ...employee, id: "00000000-0000-4000-8000-000000000003", firstName: "Sofía", role: "owner" as const };

  render(<CommissionPreview values={{ ...values, employeeId: responsibleOwner.id, grantFullServiceCommission: true }} data={{ ...data, employees: [responsibleOwner] }} onGrantFullServiceCommission={vi.fn()} />);

  const preview = screen.getByLabelText("Comisión estimada");
  expect(preview).toHaveTextContent("Servicio 0% · Productos 0%");
  expect(preview).toHaveTextContent("$ 0");
  expect(preview).toHaveTextContent("$ 26.000");
  expect(screen.queryByText(/Regalar el 100%/)).not.toBeInTheDocument();
});
