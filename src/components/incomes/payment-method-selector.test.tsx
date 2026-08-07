import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { PaymentMethodSelector } from "./payment-method-selector";

it("selects a payment method and exposes its selected state", async () => {
  const onChange = vi.fn();
  const user = userEvent.setup();
  render(
    <PaymentMethodSelector
      value="cash"
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

  expect(onChange).toHaveBeenCalledWith("transfer");
});
