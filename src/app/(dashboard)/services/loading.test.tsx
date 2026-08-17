import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import ServicesLoading from "./loading";

it("centers the services loading state", () => {
  render(<ServicesLoading />);
  expect(screen.getByRole("status", { name: "Cargando servicios" })).toBeVisible();
  expect(screen.getByText("Preparando el catálogo")).toBeVisible();
});
