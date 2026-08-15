import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import CashLoading from "./loading";

it("centers the cash loading state", () => {
  render(<CashLoading />);
  expect(
    screen.getByRole("status", { name: "Cargando caja" }),
  ).toBeVisible();
  expect(screen.getByText("Calculando la caja")).toBeVisible();
});

