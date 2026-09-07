import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CashConfirmDialog } from "./cash-confirm-dialog";
import { CashOpeningBalanceDialog } from "./cash-opening-balance-dialog";

describe("cash money dialogs", () => {
  it("keeps the opening balance in integer ARS", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<CashOpeningBalanceDialog openingBalance={0} onClose={vi.fn()} onConfirm={onConfirm} />);

    const input = screen.getByLabelText("Saldo inicial");
    await user.clear(input);
    await user.type(input, "100");

    expect(screen.getByRole("button", { name: /Guardar saldo inicial/ })).toHaveTextContent("$ 100");
    await user.click(screen.getByRole("button", { name: /Guardar saldo inicial/ }));
    expect(onConfirm).toHaveBeenCalledWith({ openingBalance: 100 });
  });

  it("keeps the physical count in integer ARS", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<CashConfirmDialog expectedCash={100} onClose={vi.fn()} onConfirm={onConfirm} />);

    expect(screen.getByLabelText("Conteo físico final")).toHaveValue(100);
    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(onConfirm).toHaveBeenCalledWith({ countedCash: 100 });
  });
});
