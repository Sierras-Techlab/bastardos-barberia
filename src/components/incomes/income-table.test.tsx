import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import mock from "@/data/incomes.mock";
import type { IncomeListData } from "@/types/income";
import { IncomeTable } from "./income-table";

const data = mock as IncomeListData;

it("paginates ten accessible income rows", async () => {
  const user = userEvent.setup();
  const onSelect = vi.fn();
  const incomes = data.incomes.slice(0, 12);

  render(<IncomeTable incomes={incomes} onSelect={onSelect} />);

  expect(screen.getAllByRole("row")).toHaveLength(11);
  expect(screen.getByText(/página 1 de 2/i)).toBeVisible();
  expect(screen.getByRole("columnheader", { name: /fecha/i })).toBeVisible();
  expect(screen.getByRole("columnheader", { name: /concepto/i })).toBeVisible();
  expect(screen.getByText("Anulado")).toBeVisible();

  await user.click(screen.getByRole("button", { name: /siguiente/i }));

  expect(screen.getByText(/página 2 de 2/i)).toBeVisible();
  await user.click(
    screen.getByRole("button", {
      name: `Abrir ingreso ${incomes[10].id}`,
    }),
  );
  expect(onSelect).toHaveBeenCalledWith(incomes[10]);
});

it("keeps rows semantic and exposes one explicit action", () => {
  const onSelect = vi.fn();

  render(<IncomeTable incomes={[data.incomes[0]]} onSelect={onSelect} />);

  const row = screen.getByRole("row", {
    name: `Ingreso ${data.incomes[0].id}`,
  });
  expect(row).not.toHaveAttribute("tabindex");
  expect(
    screen.getByRole("button", {
      name: `Abrir ingreso ${data.incomes[0].id}`,
    }),
  ).toBeVisible();
});

it("shows combined payment and canonical commission", () => {
  const incomeWithCommission = { ...data.incomes[0], payments: [{ paymentMethodId: "60000000-0000-4000-8000-000000000001", methodName: "Efectivo", amount: 20000 }, { paymentMethodId: "60000000-0000-4000-8000-000000000002", methodName: "Transferencia", amount: 19000 }, { paymentMethodId: "60000000-0000-4000-8000-000000000003", methodName: "Tarjeta", amount: 10000 }], commission: { total: 11550, barbershopNet: 37450 } };
  render(<IncomeTable incomes={[incomeWithCommission, data.incomes[1]]} onSelect={vi.fn()} />);
  expect(screen.getByText("Combinado (3 medios)")).toBeVisible();
  expect(screen.getByText(/11\.550/)).toBeVisible();
  expect(screen.queryByText("Pendiente de backend")).not.toBeInTheDocument();
});
