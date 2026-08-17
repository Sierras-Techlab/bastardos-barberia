import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import IncomesLoading from "./loading";

it("shows an accessible income history loading state", () => {
  render(<IncomesLoading />);

  expect(screen.getByRole("status")).toHaveAccessibleName(/cargando ingresos/i);
  expect(screen.getByText(/preparando el historial/i)).toBeVisible();
});
