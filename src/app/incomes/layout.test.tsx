import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import IncomesLayout from "./layout";

it("provides one persistent shell for every incomes child route", () => {
  render(
    <IncomesLayout>
      <p>Contenido de la ruta</p>
    </IncomesLayout>,
  );

  expect(screen.getByText("Contenido de la ruta")).toBeVisible();
  expect(screen.getByAltText("Bastardos Barbería")).toBeVisible();
  expect(screen.getByRole("link", { name: "Ingresos" })).toHaveAttribute(
    "data-active",
  );
  expect(screen.getByRole("main")).toHaveAttribute(
    "data-slot",
    "sidebar-inset",
  );
});
