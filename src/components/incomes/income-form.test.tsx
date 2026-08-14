import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { IncomeForm } from "@/components/incomes/income-form";
import type { IncomeClient } from "@/lib/incomes/client";
import type { Income, IncomeFormData } from "@/types/income";
import type { CreateIncomeInput } from "@/types/income";

const serviceId = "30000000-0000-4000-8000-000000000001";
const data: IncomeFormData = {
  currentUser: { id: "00000000-0000-4000-8000-000000000003", firstName: "Fernanda", lastName: "Pérez", role: "employee" },
  customers: [], services: [{ id: serviceId, name: "Barba", price: 13000 }], products: [],
  employees: [{ id: "00000000-0000-4000-8000-000000000003", firstName: "Fernanda", lastName: "Pérez", role: "employee", isActive: true, serviceCommissionRate: 45, productCommissionRate: 10 }],
};
const result = (input: CreateIncomeInput): Income => ({ id: "20000000-0000-4000-8000-000000000001", createdAt: "2026-08-11T12:00:00.000Z", businessDate: "2026-08-11", employee: data.currentUser, customer: null, service: { ...data.services[0], commission: { subtotal: 13000, rate: 45, amount: 5850, fullCommission: false, authorizedBy: null } }, products: [], paymentMethod: input.payments[0].method, commission: { total: 5850, barbershopNet: 7150 }, total: 13000, status: "active" });
const client = (create = vi.fn(async (input: CreateIncomeInput) => result(input))): Pick<IncomeClient, "create"> => ({ create });
const review = async (user: ReturnType<typeof userEvent.setup>) => { await user.click(screen.getByRole("button", { name: /barba/i })); await user.click(screen.getByRole("button", { name: /efectivo/i })); await user.click(screen.getByRole("button", { name: /revisar ingreso/i })); };

describe("IncomeForm", () => {
  it("lets a manager select the responsible employee", () => {
    render(<IncomeForm data={{ ...data, currentUser: { ...data.currentUser, role: "owner" } }} incomeClient={client()} />);
    expect(screen.getByRole("combobox", { name: /empleado responsable/i })).toBeInTheDocument();
    expect(screen.getAllByText("Fernanda Pérez")).not.toHaveLength(0);
  });
  it("validates an item and payment before review", async () => {
    const user = userEvent.setup(); render(<IncomeForm data={data} incomeClient={client()} />);
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
    const managerData: IncomeFormData = { ...data, currentUser: { ...data.currentUser, id: "00000000-0000-4000-8000-000000000001", role: "admin" }, products: [{ id: "product", name: "Pomada", price: 10000, stock: 3 }], employees: [{ id: "00000000-0000-4000-8000-000000000001", firstName: "Fernanda", lastName: "Pérez", role: "admin", isActive: true, serviceCommissionRate: 0, productCommissionRate: 0 }, { id: "00000000-0000-4000-8000-000000000002", firstName: "Diego", lastName: "Gómez", role: "employee", isActive: true, serviceCommissionRate: 45, productCommissionRate: 10 }, { id: "00000000-0000-4000-8000-000000000004", firstName: "Sofía", lastName: "Dueña", role: "owner", isActive: true, serviceCommissionRate: 0, productCommissionRate: 0 }] };
    const create = vi.fn(async (input: CreateIncomeInput) => result(input));
    const user = userEvent.setup();
    render(<IncomeForm data={managerData} incomeClient={client(create)} />);
    await user.selectOptions(screen.getByRole("combobox", { name: /empleado responsable/i }), "00000000-0000-4000-8000-000000000002");
    await user.click(screen.getByRole("button", { name: /barba/i }));
    await user.click(screen.getByRole("button", { name: /agregar pomada/i }));
    await user.click(screen.getByRole("checkbox", { name: /otorgar comisión completa/i }));
    await user.click(screen.getByRole("checkbox", { name: /regalar el 100%/i }));
    await user.selectOptions(screen.getByRole("combobox", { name: /empleado responsable/i }), targetEmployeeId);
    expect(screen.queryByRole("checkbox", { name: /otorgar comisión completa/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /regalar el 100%/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /efectivo/i }));
    await user.click(screen.getByRole("button", { name: /revisar ingreso/i }));
    await user.click(screen.getByRole("button", { name: /^confirmar ingreso$/i }));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      employeeId: targetEmployeeId,
      grantFullServiceCommission: false,
      products: [{ productId: "product", quantity: 1, grantFullCommission: false }],
    }));
  });

  it("never shows exception controls to an authenticated employee", async () => {
    const user = userEvent.setup();
    render(<IncomeForm data={{ ...data, products: [{ id: "product", name: "Pomada", price: 10000, stock: 3 }] }} incomeClient={client()} />);
    await user.click(screen.getByRole("button", { name: /barba/i }));
    await user.click(screen.getByRole("button", { name: /agregar pomada/i }));
    expect(screen.queryByRole("checkbox", { name: /otorgar comisión completa/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /regalar el 100%/i })).not.toBeInTheDocument();
  });
});
