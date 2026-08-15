import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import mock from "@/data/incomes.mock";
import type { IncomeListData } from "@/types/income";
import { IncomeTable } from "./income-table";

const data = mock as IncomeListData;

it("renders every server-provided income row without local pagination", async () => {
  const user = userEvent.setup();
  const onSelect = vi.fn();
  const incomes = data.incomes.slice(0, 12);

  render(<IncomeTable incomes={incomes} onSelect={onSelect} />);

  expect(screen.getAllByRole("row")).toHaveLength(13);
  expect(screen.queryByText(/página \d+ de \d+/i)).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /siguiente/i })).not.toBeInTheDocument();
  expect(screen.getByRole("columnheader", { name: /fecha/i })).toBeVisible();
  expect(screen.getByRole("columnheader", { name: /concepto/i })).toBeVisible();
  expect(screen.getByText("Anulado")).toBeVisible();

  await user.click(
    screen.getByRole("button", {
      name: `Abrir ingreso ${incomes[11].id}`,
    }),
  );
  expect(onSelect).toHaveBeenCalledWith(incomes[11]);
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
