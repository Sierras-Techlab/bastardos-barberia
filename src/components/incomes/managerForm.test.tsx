import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { IncomeForm } from "@/components/incomes/income-form";
import type { IncomeClient } from "@/lib/incomes/client";
import type { Income, IncomeFormData } from "@/types/income";
import type { CreateIncomeInput } from "@/types/income";

describe("IncomeForm (manager)", () => {

const serviceId = "30000000-0000-4000-8000-000000000001";
const paymentMethods = [
  { id: "60000000-0000-4000-8000-000000000001", name: "Efectivo", isActive: true },
  { id: "60000000-0000-4000-8000-000000000002", name: "Transferencia", isActive: true },
  { id: "60000000-0000-4000-8000-000000000003", name: "Tarjeta", isActive: true },
];
const data: IncomeFormData = {
  viewer: "manager",
  currentUser: { id: "00000000-0000-4000-8000-000000000003", firstName: "Fernanda", lastName: "Pérez", role: "employee" },
  customers: [], services: [{ id: serviceId, name: "Barba", price: 13000 }], products: [],
  paymentMethods,
  employees: [{ id: "00000000-0000-4000-8000-000000000003", firstName: "Fernanda", lastName: "Pérez", role: "employee", isActive: true, serviceCommissionRate: 45, productCommissionRate: 10 }],
};
const managerData: IncomeFormData = {
  ...data,
  currentUser: { ...data.currentUser, id: "00000000-0000-4000-8000-000000000001", role: "admin" },
  services: [
    ...data.services,
    { id: "30000000-0000-4000-8000-000000000002", name: "Corte", price: 16000 },
  ],
  products: [
    { id: "product", name: "Pomada", price: 10000, stock: 3 },
    { id: "shampoo", name: "Shampoo", price: 12000, stock: 3 },
  ],
  employees: [
    { id: "00000000-0000-4000-8000-000000000001", firstName: "Fernanda", lastName: "Pérez", role: "admin", isActive: true, serviceCommissionRate: 0, productCommissionRate: 0 },
    { id: "00000000-0000-4000-8000-000000000002", firstName: "Diego", lastName: "Gómez", role: "employee", isActive: true, serviceCommissionRate: 45, productCommissionRate: 10 },
    { id: "00000000-0000-4000-8000-000000000004", firstName: "Sofía", lastName: "Dueña", role: "owner", isActive: true, serviceCommissionRate: 0, productCommissionRate: 0 },
  ],
};
const result = (input: CreateIncomeInput): Income => ({
  id: "20000000-0000-4000-8000-000000000001",
  createdAt: "2026-08-11T12:00:00.000Z",
  businessDate: "2026-08-11",
  employee: data.currentUser,
  registeredBy: data.currentUser,
  customer: null,
  service: { ...data.services[0], commission: { subtotal: 13000, rate: 45, amount: 5850, fullCommission: false, authorizedBy: null } },
  products: [],
  payments: input.payments
    .filter((payment): payment is { paymentMethodId: string; amount: number } => "amount" in payment)
    .map((payment) => ({ paymentMethodId: payment.paymentMethodId, methodName: paymentMethods.find((method) => method.id === payment.paymentMethodId)?.name ?? "Desconocido", amount: payment.amount })),
  commission: { total: 5850, barbershopNet: 7150 },
  total: 13000,
  status: "active",
});
const client = (create = vi.fn(async (input: CreateIncomeInput) => result(input))): Pick<IncomeClient, "create"> => ({ create });
const review = async (user: ReturnType<typeof userEvent.setup>) => { await user.click(screen.getByRole("button", { name: /barba/i })); await user.click(screen.getByRole("button", { name: /revisar ingreso/i })); };

  it("lets a manager select the responsible employee", () => {
    render(<IncomeForm data={{ ...data, currentUser: { ...data.currentUser, role: "owner" } }} incomeClient={client()} />);
    expect(screen.getByRole("combobox", { name: /empleado responsable/i })).toBeInTheDocument();
    expect(screen.getAllByText("Fernanda Pérez")).not.toHaveLength(0);
  });
  it("validates an item and payment before review", async () => {
    const user = userEvent.setup(); render(<IncomeForm data={{ ...data, paymentMethods: [] }} incomeClient={client()} />);
    await user.click(screen.getByRole("button", { name: /revisar ingreso/i }));
    expect(await screen.findByText("Seleccioná un servicio o agregá al menos un producto.")).toBeVisible();
    expect(screen.getByText("Seleccioná un medio de pago.")).toBeVisible();
  });
  it("sends a generated request id and no actor, total or date", async () => {
    const user = userEvent.setup(); const create = vi.fn(async (input: CreateIncomeInput) => result(input));
    render(<IncomeForm data={data} incomeClient={client(create)} />); await review(user); await user.click(screen.getByRole("button", { name: /^confirmar ingreso$/i }));
    const input = create.mock.calls[0][0];
    expect(input.requestId).toMatch(/^[0-9a-f-]{36}$/); expect(input.employeeId).toBe(data.currentUser.id); expect(input).not.toHaveProperty("total"); expect(input).not.toHaveProperty("createdAt");
    expect(await screen.findByRole("heading", { name: /ingreso registrado/i })).toBeVisible();
  });
  it("locks repeated confirmation while using one request id", async () => {
    let resolve!: (income: Income) => void; const pending = new Promise<Income>((done) => { resolve = done; }); const create = vi.fn<(input: CreateIncomeInput) => Promise<Income>>(() => pending);
    const user = userEvent.setup(); render(<IncomeForm data={data} incomeClient={client(create)} />); await review(user);
    const confirm = screen.getByRole("button", { name: /^confirmar ingreso$/i }); await user.dblClick(confirm);
    expect(create).toHaveBeenCalledOnce(); resolve(result(create.mock.calls[0][0]));
    expect(await screen.findByRole("heading", { name: /ingreso registrado/i })).toBeVisible();
  });
  it("preserves the draft after insufficient stock", async () => {
    const create = vi.fn().mockRejectedValue(new Error("No hay stock suficiente de Gel.")); const user = userEvent.setup();
    render(<IncomeForm data={data} incomeClient={client(create)} />); await review(user); await user.click(screen.getByRole("button", { name: /^confirmar ingreso$/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No hay stock suficiente de Gel.");
    expect(screen.getByRole("button", { name: /barba/i })).toHaveAttribute("aria-pressed", "true");
  });
  it.each([
    ["their own account", "00000000-0000-4000-8000-000000000001"],
    ["an owner", "00000000-0000-4000-8000-000000000004"],
  ])("clears all overrides when a manager changes attribution to %s", async (_label, targetEmployeeId) => {
    const create = vi.fn(async (input: CreateIncomeInput) => result(input));
    const user = userEvent.setup();
    render(<IncomeForm data={managerData} incomeClient={client(create)} />);
    await user.selectOptions(screen.getByRole("combobox", { name: /empleado responsable/i }), "00000000-0000-4000-8000-000000000002");
    await user.click(screen.getByRole("button", { name: /barba/i }));
    await user.click(screen.getByRole("button", { name: /agregar pomada/i }));
    await user.click(screen.getByRole("checkbox", { name: /regalar el 100% del valor/i }));
    await user.click(screen.getByRole("checkbox", { name: /regalar el 100% de este servicio/i }));
    await user.selectOptions(screen.getByRole("combobox", { name: /empleado responsable/i }), targetEmployeeId);
    expect(screen.queryByRole("checkbox", { name: /regalar el 100% del valor/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /regalar el 100%/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /revisar ingreso/i }));
    await user.click(screen.getByRole("button", { name: /^confirmar ingreso$/i }));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      employeeId: targetEmployeeId,
      grantFullServiceCommission: false,
      products: [{ productId: "product", quantity: 1, grantFullCommission: false }],
    }));
  });

  it.each([
    ["removes", serviceId],
    ["changes", "30000000-0000-4000-8000-000000000002"],
  ])("clears the hidden service override when a manager %s the selected service", async (_label, nextServiceId) => {
    const create = vi.fn(async (input: CreateIncomeInput) => result(input));
    const user = userEvent.setup();
    render(<IncomeForm data={managerData} incomeClient={client(create)} />);
    await user.selectOptions(screen.getByRole("combobox", { name: /empleado responsable/i }), "00000000-0000-4000-8000-000000000002");
    await user.click(screen.getByRole("button", { name: /barba/i }));
    await user.click(screen.getByRole("button", { name: /agregar pomada/i }));
    await user.click(screen.getByRole("checkbox", { name: /regalar el 100% de este servicio/i }));
    await user.click(screen.getByRole("button", { name: nextServiceId === serviceId ? /barba/i : /corte/i }));
    await user.click(screen.getByRole("button", { name: /revisar ingreso/i }));
    await user.click(screen.getByRole("button", { name: /^confirmar ingreso$/i }));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      serviceId: nextServiceId === serviceId ? null : nextServiceId,
      grantFullServiceCommission: false,
    }));
  });

  it("submits simultaneous full service and product lines for another non-owner", async () => {
    const create = vi.fn(async (input: CreateIncomeInput) => result(input));
    const user = userEvent.setup();
    render(<IncomeForm data={managerData} incomeClient={client(create)} />);
    await user.selectOptions(screen.getByRole("combobox", { name: /empleado responsable/i }), "00000000-0000-4000-8000-000000000002");
    await user.click(screen.getByRole("button", { name: /barba/i }));
    await user.click(screen.getByRole("button", { name: /agregar pomada/i }));
    await user.click(screen.getByRole("button", { name: /agregar shampoo/i }));
    await user.click(screen.getByRole("checkbox", { name: /regalar el 100% de este servicio/i }));
    await user.click(screen.getByRole("checkbox", { name: "Regalar el 100% del valor de 1 unidad de Pomada" }));
    await user.click(screen.getByRole("checkbox", { name: "Regalar el 100% del valor de 1 unidad de Shampoo" }));
    await user.click(screen.getByRole("button", { name: /revisar ingreso/i }));
    const dialog = screen.getByRole("dialog", { name: /confirmar ingreso/i });
    expect(dialog).toHaveTextContent("Barba · 100%");
    expect(dialog).toHaveTextContent("Pomada · 100%");
    expect(dialog).toHaveTextContent("Shampoo · 100%");
    await user.click(screen.getByRole("button", { name: /^confirmar ingreso$/i }));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      employeeId: "00000000-0000-4000-8000-000000000002",
      serviceId,
      grantFullServiceCommission: true,
      products: [
        { productId: "product", quantity: 1, grantFullCommission: true },
        { productId: "shampoo", quantity: 1, grantFullCommission: true },
      ],
    }));
  });

  it("never shows exception controls to an authenticated employee", async () => {
    const user = userEvent.setup();
    render(<IncomeForm data={{ ...data, products: [{ id: "product", name: "Pomada", price: 10000, stock: 3 }] }} incomeClient={client()} />);
    await user.click(screen.getByRole("button", { name: /barba/i }));
    await user.click(screen.getByRole("button", { name: /agregar pomada/i }));
    expect(screen.queryByRole("checkbox", { name: /regalar el 100% del valor/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /regalar el 100%/i })).not.toBeInTheDocument();
  });
});
