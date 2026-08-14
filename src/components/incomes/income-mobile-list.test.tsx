import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import mock from "@/data/incomes.mock.json";
import type { IncomeListData } from "@/types/income";
import { IncomeMobileList } from "./income-mobile-list";

const data = mock as IncomeListData;

it("shows compact income cards and opens the selected detail", async () => {
  const onSelect = vi.fn();
  const user = userEvent.setup();
  const income = data.incomes[0];

  render(<IncomeMobileList incomes={[income]} onSelect={onSelect} />);

  const card = screen.getByRole("button", {
    name: `Abrir ingreso ${income.id}`,
  });
  expect(within(card).getByText(/corte, perfilado y barba/i)).toBeVisible();
  expect(within(card).getByText(/transferencia/i)).toBeVisible();
  expect(within(card).getByText(/49\.000/i)).toBeVisible();

  await user.click(card);
  expect(onSelect).toHaveBeenCalledWith(income);
});

it("identifies voided cards", () => {
  const voided = data.incomes.find((income) => income.status === "voided");

  render(<IncomeMobileList incomes={voided ? [voided] : []} onSelect={vi.fn()} />);

  expect(screen.getByText("Anulado")).toBeVisible();
});

it("shows combined payment and accrued commission", () => {
  const income = { ...data.incomes[0], payments: [{ method: "cash" as const, amount: 20000 }, { method: "transfer" as const, amount: 29000 }], commission: { total: 11550, barbershopNet: 37450 } };
  render(<IncomeMobileList incomes={[income]} onSelect={vi.fn()} />);
  expect(screen.getByText("Combinado")).toBeVisible();
  expect(screen.getByText(/Comisión.*11\.550/)).toBeVisible();
});
