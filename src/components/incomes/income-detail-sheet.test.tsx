import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import mock from "@/data/incomes.mock.json";
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
    screen.getByText(new RegExp(income?.products[0].name ?? "", "i")),
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

it("shows split payments and manager-only audit economics", () => {
  const income = { ...data.incomes[0], registeredBy: { id: "manager", firstName: "Ana", lastName: "Admin" }, payments: [{ method: "cash" as const, amount: 20000 }, { method: "transfer" as const, amount: 29000 }], commission: { serviceBase: 19000, productBase: 30000, serviceRate: 45, productRate: 10, serviceAmount: 8550, productAmount: 3000, total: 11550, barbershopNet: 37450, fullServiceCommission: false } };
  render(<IncomeDetailSheet income={income} open viewerRole="owner" onOpenChange={vi.fn()} />);
  expect(screen.getByText("Registrado por")).toBeVisible();
  expect(screen.getByText("Ana Admin")).toBeVisible();
  expect(screen.getByText("Efectivo")).toBeVisible();
  expect(screen.getByText("Transferencia")).toBeVisible();
  expect(screen.getByText(/20\.000/)).toBeVisible();
  expect(screen.getByText(/29\.000/)).toBeVisible();
  expect(screen.getByText("Neto barbería")).toBeVisible();
});

it("hides manager-only net and registrator from employees", () => {
  const income = { ...data.incomes[0], registeredBy: { id: "manager", firstName: "Ana", lastName: "Admin" } };
  render(<IncomeDetailSheet income={income} open viewerRole="employee" onOpenChange={vi.fn()} />);
  expect(screen.queryByText("Registrado por")).not.toBeInTheDocument();
  expect(screen.queryByText("Neto barbería")).not.toBeInTheDocument();
  expect(screen.getByText("Pendiente de backend")).toBeVisible();
});

it("shows commission bases and the manager who authorized a full service", () => {
  const income = {
    ...data.incomes[0],
    registeredBy: { id: "manager", firstName: "Ana", lastName: "Admin" },
    payments: [{ method: "cash" as const, amount: 49000 }],
    commission: {
      serviceBase: 19000,
      productBase: 30000,
      serviceRate: 100,
      productRate: 10,
      serviceAmount: 19000,
      productAmount: 3000,
      total: 22000,
      barbershopNet: 27000,
      fullServiceCommission: true,
      authorizedBy: { id: "manager", firstName: "Ana", lastName: "Admin" },
    },
  };

  render(<IncomeDetailSheet income={income} open viewerRole="owner" onOpenChange={vi.fn()} />);

  expect(screen.getByText("Base servicios")).toBeVisible();
  expect(screen.getByText("Base productos")).toBeVisible();
  expect(screen.getByText("Autorizado por")).toBeVisible();
  expect(screen.getAllByText("Ana Admin")).toHaveLength(2);
});
