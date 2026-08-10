import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import CustomersLoading from "./loading";

it("centers the customer loading state inside the dashboard content", () => {
  render(<CustomersLoading />);

  expect(screen.getByRole("status", { name: "Cargando clientes" })).toBeVisible();
  expect(screen.getByText("Preparando el directorio")).toBeVisible();
});
