import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CashCloseDialog } from "./cash-close-dialog";
import { CashOpenDialog } from "./cash-open-dialog";

describe("cash money dialogs", () => {
  it("keeps the opening balance in integer ARS", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<CashOpenDialog openingBalance={0} onClose={vi.fn()} onConfirm={onConfirm} />);

    const input = screen.getByLabelText("Saldo inicial");
    await user.clear(input);
    await user.type(input, "100");

    expect(screen.getByRole("button", { name: /Abrir caja/ })).toHaveTextContent("$ 100");
    await user.click(screen.getByRole("button", { name: /Abrir caja/ }));
    expect(onConfirm).toHaveBeenCalledWith({ openingBalance: 100 });
  });

  it("keeps the physical count in integer ARS", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<CashCloseDialog expectedCash={100} mode="manual" onClose={vi.fn()} onConfirm={onConfirm} />);

    expect(screen.getByLabelText("Conteo físico")).toHaveValue(100);
    await user.click(screen.getByRole("button", { name: "Confirmar y cerrar" }));
    expect(onConfirm).toHaveBeenCalledWith({ countedCash: 100 });
  });
});
