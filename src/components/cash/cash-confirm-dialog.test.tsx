import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CashConfirmDialog } from "./cash-confirm-dialog";

describe("CashConfirmDialog", () => {
  it("forwards the integer counted cash and allows a non-zero difference", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<CashConfirmDialog expectedCash={17000} onClose={vi.fn()} onConfirm={onConfirm} />);
    const input = screen.getByLabelText("Conteo físico final");
    expect(input).toHaveAttribute("step", "1");
    await user.clear(input);
    await user.type(input, "17500");
    expect(screen.getByText(/sobran \$ 500/i)).toBeVisible();
    await user.click(screen.getByRole("button", { name: /confirmar/i }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith({ countedCash: 17500 }));
  });
});