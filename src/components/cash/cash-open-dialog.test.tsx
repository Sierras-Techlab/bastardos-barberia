import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CashOpenDialog } from "./cash-open-dialog";

describe("CashOpenDialog", () => {
  it("accepts a non-negative integer ARS opening balance and forwards it as integer", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<CashOpenDialog openingBalance={0} onClose={vi.fn()} onConfirm={onConfirm} />);
    const input = screen.getByLabelText("Saldo inicial");
    expect(input).toHaveAttribute("type", "number");
    expect(input).toHaveAttribute("step", "1");
    await user.clear(input);
    await user.type(input, "15000");
    await user.click(screen.getByRole("button", { name: /abrir caja/i }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith({ openingBalance: 15000 }));
  });

  it("rejects negative opening balances", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<CashOpenDialog openingBalance={0} onClose={vi.fn()} onConfirm={onConfirm} />);
    const input = screen.getByLabelText("Saldo inicial");
    await user.clear(input);
    await user.type(input, "-100");
    await user.click(screen.getByRole("button", { name: /abrir caja/i }));
    expect(onConfirm).not.toHaveBeenCalled();
  });
});