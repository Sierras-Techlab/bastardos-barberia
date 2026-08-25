import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CashCloseDialog } from "./cash-close-dialog";

describe("CashCloseDialog", () => {
  it("forwards an integer counted cash and never blocks on a non-zero difference", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<CashCloseDialog expectedCash={17000} mode="manual" onClose={vi.fn()} onConfirm={onConfirm} />);
    const input = screen.getByLabelText("Conteo físico");
    expect(input).toHaveAttribute("step", "1");
    await user.clear(input);
    await user.type(input, "16500");
    expect(screen.getByText(/faltan \$ 500/i)).toBeVisible();
    await user.click(screen.getByRole("button", { name: /cerrar y registrar diferencia/i }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith({ countedCash: 16500 }));
  });

  it("uses automatic mode copy and confirms exactly on zero difference", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<CashCloseDialog expectedCash={17000} mode="automatic" onClose={vi.fn()} onConfirm={onConfirm} />);
    const input = screen.getByLabelText("Conteo físico");
    await user.clear(input);
    await user.type(input, "17000");
    expect(screen.getByText(/sin diferencia/i)).toBeVisible();
    await user.click(screen.getByRole("button", { name: /confirmar conteo/i }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith({ countedCash: 17000 }));
  });
});