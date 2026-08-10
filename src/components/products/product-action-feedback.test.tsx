import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { ProductActionFeedback } from "@/components/products/product-action-feedback";

it("announces the successful action and supports manual dismissal", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  render(
    <ProductActionFeedback
      message="Producto añadido correctamente."
      onClose={onClose}
    />,
  );

  const status = screen.getByRole("status");
  expect(status).toHaveAttribute("aria-live", "polite");
  expect(status).toHaveTextContent("Producto añadido correctamente.");

  await user.click(
    screen.getByRole("button", { name: "Cerrar notificación" }),
  );
  expect(onClose).toHaveBeenCalledOnce();
});
