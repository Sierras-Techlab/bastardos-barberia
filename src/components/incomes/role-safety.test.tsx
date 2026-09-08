import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { IncomeForm } from "@/components/incomes/income-form";
import { CommissionPreview } from "@/components/incomes/commission-preview";
import type { IncomeClient } from "@/lib/incomes/client";
import type { EmployeeIncomeFormValues } from "@/lib/incomes/income-schema";
import type { CreateIncomeInput, Income, IncomeFormData, UserRole } from "@/types/income";

const ownerId = "00000000-0000-4000-8000-000000000001";
const employeeId = "00000000-0000-4000-8000-800000000003";
const serviceId = "00000000-0000-4000-8000-000000000004";
const productId = "00000000-0000-4000-8000-000000000006";
const cashId = "60000000-0000-4000-8000-000000000005";
const transferId = "60000000-0000-4000-8000-000000000007";

const employeeFormData: IncomeFormData = {
  viewer: "employee",
  currentUser: { id: employeeId, firstName: "Fer", lastName: "Pérez", role: "employee" },
  services: [{ id: serviceId, name: "Corte", price: 10000, earning: 5000, commissionRate: 50 }],
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
    create: vi.fn(async (_role: UserRole, input: CreateIncomeInput): Promise<Income> => {
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

const FORBIDDEN_KEYS = ["catalogUnitPrice", "total", "barbershopNet", "registeredBy", "amount"];

describe("020 application layer role safety", () => {
  it("hides the manager-only professional selector and renders the form for an employee", () => {
    const client: Pick<IncomeClient, "create"> = { create: vi.fn() };
    render(<IncomeForm data={employeeFormData} incomeClient={client} />);
    expect(screen.queryByRole("combobox", { name: /empleado responsable/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Corte/i })).toBeInTheDocument();
    expect(screen.getByText("Cera")).toBeInTheDocument();
  });

  it("exposes only service prices through the serialized employee form data", () => {
    expect(employeeFormData.services[0]).toMatchObject({ price: 10000 });
    expect(employeeFormData.products[0]).not.toHaveProperty("price");
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

  it("recalculates the employee earning from the overridden service price", () => {
    render(
      <CommissionPreview
        values={{
          ...employeeFormValues,
          products: [],
          grantFullServiceCommission: false,
          servicePriceOverride: {
            chargedUnitPrice: 7000,
            reason: "Precio acordado",
          },
        }}
        data={employeeFormData}
      />,
    );

    expect(screen.getByText(/3\.500/)).toBeVisible();
  });

  it("submits an employee service price override without product price authority", async () => {
    const user = userEvent.setup();
    const { client, calls } = captureCreate();
    render(<IncomeForm data={employeeFormData} incomeClient={client} />);
    await user.click(screen.getByRole("button", { name: /Corte/i }));
    await user.click(screen.getByRole("button", { name: /agregar cera/i }));
    await user.click(screen.getByRole("checkbox", { name: "Modificar precio de Corte" }));
    const chargedPrice = screen.getByRole("spinbutton", { name: "Precio cobrado de Corte" });
    await user.clear(chargedPrice);
    await user.type(chargedPrice, "7000");
    await user.type(screen.getByRole("textbox", { name: "Motivo del cambio de precio de Corte" }), "Precio acordado");
    expect(screen.queryByRole("checkbox", { name: "Modificar precio de Cera × 1" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /revisar ingreso/i }));
    await user.click(screen.getByRole("button", { name: /^confirmar ingreso$/i }));
    await waitFor(() => expect(calls).toHaveLength(1));
    const input = calls[0];
    expect(input.payments).toEqual([{ paymentMethodId: cashId, basisPoints: 10000 }]);
    expect(input.servicePriceOverride).toEqual({ chargedUnitPrice: 7000, reason: "Precio acordado" });
    expect(input).not.toHaveProperty("productPriceOverrides");
    FORBIDDEN_KEYS.forEach((key) => {
      expect(JSON.stringify(input)).not.toMatch(new RegExp(`"${key}"\\s*:`, "i"));
    });
  });

  it("clears the price override when the employee switches directly to another service", async () => {
    const user = userEvent.setup();
    const { client, calls } = captureCreate();
    const secondServiceId = "00000000-0000-4000-8000-000000000006";
    render(
      <IncomeForm
        data={{
          ...employeeFormData,
          services: [
            ...employeeFormData.services,
            {
              id: secondServiceId,
              name: "Barba",
              price: 8000,
              earning: 4000,
              commissionRate: 50,
            },
          ],
        }}
        incomeClient={client}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Corte/i }));
    await user.click(
      screen.getByRole("checkbox", { name: "Modificar precio de Corte" }),
    );
    const cutPrice = screen.getByRole("spinbutton", {
      name: "Precio cobrado de Corte",
    });
    await user.clear(cutPrice);
    await user.type(cutPrice, "7000");
    await user.type(
      screen.getByRole("textbox", {
        name: "Motivo del cambio de precio de Corte",
      }),
      "Precio acordado",
    );

    await user.click(screen.getByRole("button", { name: /Barba/i }));
    expect(
      screen.getByRole("checkbox", { name: "Modificar precio de Barba" }),
    ).not.toBeChecked();
    expect(
      screen.queryByRole("spinbutton", { name: "Precio cobrado de Barba" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /revisar ingreso/i }));
    await user.click(screen.getByRole("button", { name: /^confirmar ingreso$/i }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toMatchObject({
      serviceId: secondServiceId,
      servicePriceOverride: null,
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
    expect(screen.getAllByRole("alert").some((node) => /distribu/i.test(node.textContent ?? ""))).toBe(true);
  });
});
