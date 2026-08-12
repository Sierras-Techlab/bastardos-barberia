import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { PaymentMethodSelector } from "./payment-method-selector";

it("selects a payment method and exposes its selected state", async () => {
  const onChange = vi.fn();
  const user = userEvent.setup();
  render(
    <PaymentMethodSelector
      mode="cash"
      payments={[{ method: "cash", amount: 16000 }]}
      total={16000}
      onChange={onChange}
      error="Seleccioná un medio de pago."
    />,
  );

  expect(screen.getByRole("button", { name: /efectivo/i })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(screen.getByText("Seleccioná un medio de pago.")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /transferencia/i }));

  expect(onChange).toHaveBeenCalledWith("transfer", [{ method: "transfer", amount: 16000 }]);
});

it("splits the total and automatically completes the transfer remainder", async () => {
  const onChange = vi.fn();
  const user = userEvent.setup();
  const { rerender } = render(<PaymentMethodSelector mode={null} payments={[]} total={19000} onChange={onChange} />);
  await user.click(screen.getByRole("button", { name: /combinado/i }));
  expect(onChange).toHaveBeenCalledWith("combined", [{ method: "cash", amount: 0 }, { method: "transfer", amount: 19000 }]);
  rerender(<PaymentMethodSelector mode="combined" payments={[{ method: "cash", amount: 9000 }, { method: "transfer", amount: 10000 }]} total={19000} onChange={onChange} />);
  expect(screen.getByText("Importe distribuido correctamente")).toBeVisible();
});

it("shows an empty cash input instead of a sticky leading zero", () => {
  render(
    <PaymentMethodSelector
      mode="combined"
      payments={[
        { method: "cash", amount: 0 },
        { method: "transfer", amount: 19000 },
      ]}
      total={19000}
      onChange={vi.fn()}
    />,
  );

  expect(screen.getByRole("spinbutton", { name: /monto en efectivo/i })).toHaveValue(null);
  expect(screen.getByRole("spinbutton", { name: /monto por transferencia/i })).toHaveValue(19000);
});
