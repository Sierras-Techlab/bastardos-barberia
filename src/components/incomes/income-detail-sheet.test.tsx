import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import mock from "@/data/incomes.mock";
import type { IncomeListData } from "@/types/income";
import { IncomeDetailSheet } from "./income-detail-sheet";

const data = mock as IncomeListData;

it("shows the complete read-only income detail", () => {
  const income = data.incomes.find(
    (item) => item.service && item.products.length > 0,
  );

  expect(income).toBeDefined();

  render(
    <IncomeDetailSheet
      income={income ?? null}
      open
      viewerRole="employee"
      onOpenChange={vi.fn()}
    />,
  );

  expect(screen.getByRole("heading", { name: /detalle del ingreso/i })).toBeVisible();
  expect(screen.getByText(income?.service?.name ?? "")).toBeVisible();
  expect(screen.getByText(/19\.000/)).toBeVisible();
  expect(
    screen.getByText(`1 × ${income?.products[0].name}`),
  ).toBeVisible();
  expect(screen.getByText(/transferencia|efectivo/i)).toBeVisible();
  expect(
    screen.getByText(
      `${income?.employee.firstName} ${income?.employee.lastName}`,
    ),
  ).toBeVisible();
  expect(screen.queryByRole("button", { name: /anular venta/i })).not.toBeInTheDocument();
  expect(screen.getByText(/solo lectura/i)).toBeVisible();
});

it("does not render content without a selected income", () => {
  render(
    <IncomeDetailSheet income={null} open={false} viewerRole="owner" onOpenChange={vi.fn()} />,
  );

  expect(screen.queryByText(/detalle del ingreso/i)).not.toBeInTheDocument();
});

it("shows three payment snapshots including an inactive historical name and manager-only economics", () => {
  const income = { ...data.incomes[0], registeredBy: { id: "manager", firstName: "Ana", lastName: "Admin" }, payments: [{ paymentMethodId: "60000000-0000-4000-8000-000000000001", methodName: "Efectivo", amount: 20000 }, { paymentMethodId: "60000000-0000-4000-8000-000000000002", methodName: "Transferencia", amount: 19000 }, { paymentMethodId: "60000000-0000-4000-8000-000000000003", methodName: "Crédito histórico", amount: 10000 }], service: data.incomes[0].service ? { ...data.incomes[0].service, commission: { subtotal: 19000, rate: 45, amount: 8550, fullCommission: false, authorizedBy: null } } : null, products: data.incomes[0].products.map((product) => ({ ...product, commission: { subtotal: product.unitPrice * product.quantity, rate: 10, amount: 3000, fullCommission: false, authorizedBy: null } })), commission: { total: 11550, barbershopNet: 37450 } };
  render(<IncomeDetailSheet income={income} open viewerRole="owner" onOpenChange={vi.fn()} />);
  expect(screen.getByText("Registrado por")).toBeVisible();
  expect(screen.getByText("Ana Admin")).toBeVisible();
  expect(screen.getByText("Efectivo")).toBeVisible();
  expect(screen.getByText("Transferencia")).toBeVisible();
  expect(screen.getByText("Crédito histórico")).toBeVisible();
  expect(screen.getByText("Efectivo").parentElement).toHaveTextContent(/20\.000/);
  expect(screen.getByText("Transferencia").parentElement).toHaveTextContent(/19\.000/);
  expect(screen.getByText("Crédito histórico").parentElement).toHaveTextContent(/10\.000/);
  expect(screen.getByText("Neto barbería")).toBeVisible();
});

it("hides manager-only net and registrator from employees", () => {
  const income = { ...data.incomes[0], registeredBy: { id: "manager", firstName: "Ana", lastName: "Admin" } };
  render(<IncomeDetailSheet income={income} open viewerRole="employee" onOpenChange={vi.fn()} />);
  expect(screen.queryByText("Registrado por")).not.toBeInTheDocument();
  expect(screen.queryByText("Neto barbería")).not.toBeInTheDocument();
  expect(screen.queryByText("Pendiente de backend")).not.toBeInTheDocument();
  expect(screen.getByText("Comisión devengada")).toBeVisible();
});

it("shows the monthly subscription concept instead of an empty product list", () => {
  const income = {
    ...data.incomes[0],
    sourceType: "fixed_subscription" as const,
    service: null,
    products: [],
    subscription: {
      sourceType: "fixed_subscription" as const,
      period: "2026-08",
      monthlyPrice: 15000,
      label: "agosto 2026",
      employeeEarning: 4500,
      barbershopNet: 10500,
    },
    total: 15000,
    commission: { total: 4500, barbershopNet: 10500 },
  };
  render(<IncomeDetailSheet income={income} open viewerRole="owner" onOpenChange={vi.fn()} />);

  expect(screen.getByText("Mensualidad agosto 2026")).toBeVisible();
  expect(screen.getAllByText(/15\.000/).length).toBeGreaterThan(0);
  expect(screen.queryByText("0 productos")).not.toBeInTheDocument();
});

it("shows itemized commission amounts and the manager who authorized a full service", () => {
  const income = {
    ...data.incomes[0],
    registeredBy: { id: "manager", firstName: "Ana", lastName: "Admin" },
    payments: [{ paymentMethodId: "60000000-0000-4000-8000-000000000001", methodName: "Efectivo", amount: 49000 }],
    service: data.incomes[0].service ? {
      ...data.incomes[0].service,
      commission: { subtotal: 19000, rate: 100, amount: 19000, fullCommission: true, authorizedBy: { id: "manager", firstName: "Ana", lastName: "Admin" } },
    } : null,
    products: data.incomes[0].products.map((product) => ({
      ...product,
      commission: { subtotal: 30000, rate: 10, amount: 3000, fullCommission: false, authorizedBy: null },
    })),
    commission: {
      total: 22000,
      barbershopNet: 27000,
    },
  };

  render(<IncomeDetailSheet income={income} open viewerRole="owner" onOpenChange={vi.fn()} />);

  expect(screen.getByText(/Corte, perfilado y barba \(100%\)/)).toBeVisible();
  expect(screen.getByText(/Hunter Cream \(10%\)/)).toBeVisible();
  expect(screen.getByText("Autorizado por")).toBeVisible();
  expect(screen.getAllByText("Ana Admin")).toHaveLength(2);
});
