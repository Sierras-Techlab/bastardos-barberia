import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { IncomeForm } from "@/components/incomes/income-form";
import type { IncomeClient } from "@/lib/incomes/client";
import type { Income, IncomeFormData } from "@/types/income";
import type { CreateIncomeV2Input } from "@/types/income-commissions";

const serviceId = "30000000-0000-4000-8000-000000000001";
const data: IncomeFormData = {
  currentUser: { id: "00000000-0000-4000-8000-000000000003", firstName: "Fernanda", lastName: "Pérez", role: "employee" },
  customers: [], services: [{ id: serviceId, name: "Barba", price: 13000 }], products: [],
  employees: [{ id: "00000000-0000-4000-8000-000000000003", firstName: "Fernanda", lastName: "Pérez", role: "employee", isActive: true, serviceCommissionRate: 45, productCommissionRate: 10 }],
};
const result = (input: CreateIncomeV2Input): Income => ({ id: "20000000-0000-4000-8000-000000000001", createdAt: "2026-08-11T12:00:00.000Z", businessDate: "2026-08-11", employee: data.currentUser, customer: null, service: data.services[0], products: [], paymentMethod: input.payments[0].method, total: 13000, status: "active" });
const client = (createV2 = vi.fn(async (input: CreateIncomeV2Input) => result(input))): Pick<IncomeClient, "createV2"> => ({ createV2 });
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
    const user = userEvent.setup(); const create = vi.fn(async (input: CreateIncomeV2Input) => result(input));
    render(<IncomeForm data={data} incomeClient={client(create)} />); await review(user); await user.click(screen.getByRole("button", { name: /^confirmar ingreso$/i }));
    const input = create.mock.calls[0][0];
    expect(input.requestId).toMatch(/^[0-9a-f-]{36}$/); expect(input.employeeId).toBe(data.currentUser.id); expect(input).not.toHaveProperty("total"); expect(input).not.toHaveProperty("createdAt");
    expect(await screen.findByRole("heading", { name: /ingreso registrado/i })).toBeVisible();
  });
  it("locks repeated confirmation while using one request id", async () => {
    let resolve!: (income: Income) => void; const pending = new Promise<Income>((done) => { resolve = done; }); const create = vi.fn<(input: CreateIncomeV2Input) => Promise<Income>>(() => pending);
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
});
