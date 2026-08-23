import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { IncomeForm } from "@/components/incomes/income-form";
import { CommissionPreview } from "@/components/incomes/commission-preview";
import type { IncomeClient } from "@/lib/incomes/client";
import type { EmployeeIncomeFormValues } from "@/lib/incomes/income-schema";
import type { CreateIncomeInput, Income, IncomeFormData } from "@/types/income";

const ownerId = "00000000-0000-4000-8000-000000000001";
const employeeId = "00000000-0000-4000-8000-800000000003";
const serviceId = "00000000-0000-4000-8000-000000000004";
const productId = "00000000-0000-4000-8000-000000000006";
const cashId = "60000000-0000-4000-8000-000000000005";
const transferId = "60000000-0000-4000-8000-000000000007";

const employeeFormData: IncomeFormData = {
  viewer: "employee",
  currentUser: { id: employeeId, firstName: "Fer", lastName: "Pérez", role: "employee" },
  services: [{ id: serviceId, name: "Corte", earning: 5000 }],
  products: [{ id: productId, name: "Cera", earning: 500, stock: 3 }],
  customers: [],
  paymentMethods: [
    { id: cashId, name: "Efectivo", isActive: true },
    { id: transferId, name: "Transferencia", isActive: true },
  ],
};

const employeeFormValues: EmployeeIncomeFormValues = {
  employeeId,
  customerId: null,
  serviceId,
  products: [{ productId, quantity: 1, grantFullCommission: true }],
  payments: [{ paymentMethodId: cashId, basisPoints: 10000 }],
  grantFullServiceCommission: true,
  servicePriceOverride: null,
  productPriceOverrides: [],
};

const managerFormData: IncomeFormData = {
  viewer: "manager",
  currentUser: { id: ownerId, firstName: "Lautaro", lastName: "Bastardos", role: "owner" },
  services: [{ id: serviceId, name: "Corte", price: 10000 }],
  products: [{ id: productId, name: "Cera", price: 5000, stock: 3 }],
  customers: [],
  paymentMethods: [
    { id: cashId, name: "Efectivo", isActive: true },
    { id: transferId, name: "Transferencia", isActive: true },
  ],
  employees: [
    { id: ownerId, firstName: "Lautaro", lastName: "Bastardos", role: "owner", isActive: true, serviceCommissionRate: 0, productCommissionRate: 0 },
    { id: employeeId, firstName: "Fer", lastName: "Pérez", role: "employee", isActive: true, serviceCommissionRate: 50, productCommissionRate: 10 },
  ],
};

const captureCreate = () => {
  const calls: CreateIncomeInput[] = [];
  const client: Pick<IncomeClient, "create"> = {
    create: vi.fn(async (input: CreateIncomeInput): Promise<Income> => {
      calls.push(input);
      return {
        id: "20000000-0000-4000-8000-000000000001",
        createdAt: "2026-08-23T15:00:00.000Z",
        businessDate: "2026-08-23",
        sourceType: "sale" as const,
        employee: { id: employeeId, firstName: "Fer", lastName: "Pérez" },
        registeredBy: { id: ownerId, firstName: "Lautaro", lastName: "Bastardos" },
        customer: null,
        service: null,
        products: [],
        subscription: null,
        payments: [],
        commission: { total: 0, barbershopNet: 0 },
        total: 15000,
        status: "active",
      } as Income;
    }),
  };
  return { client, calls };
};

const FORBIDDEN_KEYS = ["price", "catalogUnitPrice", "chargedUnitPrice", "total", "barbershopNet", "registeredBy", "amount"];

describe("020 application layer role safety", () => {
  it("hides the manager-only professional selector and renders the form for an employee", () => {
    const client: Pick<IncomeClient, "create"> = { create: vi.fn() };
    render(<IncomeForm data={employeeFormData} incomeClient={client} />);
    expect(screen.queryByRole("combobox", { name: /empleado responsable/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Corte/i })).toBeInTheDocument();
    expect(screen.getByText("Cera")).toBeInTheDocument();
  });

  it("never leaks forbidden financial keys through the serialized employee form data", () => {
    expect(JSON.stringify(employeeFormData)).not.toMatch(/\bprice\b/i);
    expect(JSON.stringify(employeeFormData)).not.toMatch(/\bcatalogUnitPrice\b/i);
    expect(JSON.stringify(employeeFormData)).not.toMatch(/\bchargedUnitPrice\b/i);
    expect(JSON.stringify(employeeFormData)).not.toMatch(/\btotal\b/i);
    expect(JSON.stringify(employeeFormData)).not.toMatch(/\bpayments\b/i);
    expect(JSON.stringify(employeeFormData)).not.toMatch(/\bbarbershopNet\b/i);
    expect(JSON.stringify(employeeFormData)).not.toMatch(/\bregisteredBy\b/i);
  });

  it("employee preview shows only the user earning, no barbershop net or catalog price", () => {
    render(<CommissionPreview values={employeeFormValues} data={employeeFormData} />);
    expect(screen.getByText("Tu ganancia")).toBeInTheDocument();
    expect(screen.queryByText(/neto barbería/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/precio de catálogo|total de la venta/i)).not.toBeInTheDocument();
  });

  it("submits an employee sale with a single payment method using basis points", async () => {
    const user = userEvent.setup();
    const { client, calls } = captureCreate();
    render(<IncomeForm data={employeeFormData} incomeClient={client} />);
    await user.click(screen.getByRole("button", { name: /Corte/i }));
    await user.click(screen.getByRole("button", { name: /agregar cera/i }));
    await user.click(screen.getByRole("button", { name: /revisar ingreso/i }));
    await user.click(screen.getByRole("button", { name: /^confirmar ingreso$/i }));
    await waitFor(() => expect(calls).toHaveLength(1));
    const input = calls[0];
    expect(input.payments).toEqual([{ paymentMethodId: cashId, basisPoints: 10000 }]);
    FORBIDDEN_KEYS.forEach((key) => {
      expect(JSON.stringify(input)).not.toMatch(new RegExp(`"${key}"\\s*:`, "i"));
    });
  });

  it("submits a manager sale with exact ARS amounts and combined methods", async () => {
    const user = userEvent.setup();
    const { client, calls } = captureCreate();
    render(<IncomeForm data={managerFormData} incomeClient={client} />);
    await user.click(screen.getByRole("button", { name: /Corte/i }));
    await user.click(screen.getByRole("button", { name: /cera/i }));
    await user.click(screen.getByRole("button", { name: /Transferencia/i }));
    const efectivoInput = screen.getByLabelText("Monto en Efectivo");
    const transferenciaInput = screen.getByLabelText("Monto en Transferencia");
    await user.clear(efectivoInput);
    await user.type(efectivoInput, "10000");
    await user.clear(transferenciaInput);
    await user.type(transferenciaInput, "5000");
    await user.click(screen.getByRole("button", { name: /revisar ingreso/i }));
    await user.click(screen.getByRole("button", { name: /^confirmar ingreso$/i }));
    await waitFor(() => expect(calls).toHaveLength(1));
    const input = calls[0];
    expect(input.payments).toEqual([
      { paymentMethodId: cashId, amount: 10000 },
      { paymentMethodId: transferId, amount: 5000 },
    ]);
  });

  it("forbids negative payment allocations", async () => {
    const user = userEvent.setup();
    const client: Pick<IncomeClient, "create"> = { create: vi.fn() };
    render(<IncomeForm data={managerFormData} incomeClient={client} />);
    await user.click(screen.getByRole("button", { name: /Corte/i }));
    const efectivoInput = screen.getByLabelText("Monto en Efectivo");
    await user.clear(efectivoInput);
    await user.type(efectivoInput, "-100");
    await user.click(screen.getByRole("button", { name: /revisar ingreso/i }));
    expect(screen.getByRole("alert").textContent).toMatch(/distribu/i);
  });
});