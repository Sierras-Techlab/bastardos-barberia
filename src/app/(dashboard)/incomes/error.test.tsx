import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import IncomesError from "./error";

it("offers retry when the income history cannot load", async () => {
  const retry = vi.fn();
  const user = userEvent.setup();

  render(<IncomesError error={new Error("network")} retry={retry} />);

  expect(screen.getByText(/no pudimos cargar los ingresos/i)).toBeVisible();
  await user.click(screen.getByRole("button", { name: /intentar de nuevo/i }));
  expect(retry).toHaveBeenCalledOnce();
});
