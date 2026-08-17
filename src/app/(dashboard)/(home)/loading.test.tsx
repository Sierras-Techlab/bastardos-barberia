import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import HomeLoading from "./loading";

it("shows immediate dashboard feedback when navigating back to home", () => {
  render(<HomeLoading />);

  const status = screen.getByRole("status", { name: /cargando inicio/i });
  const container = status.closest("main");

  expect(container).toHaveClass("min-h-svh", "items-center", "justify-center");
  expect(screen.getByText(/preparando el resumen/i)).toBeVisible();
});
