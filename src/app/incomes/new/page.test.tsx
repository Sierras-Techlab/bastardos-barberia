import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import NewIncomePage, { metadata } from "./page";
import IncomesLayout from "../layout";

it("composes the Bastardos income form route", () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  render(
    <IncomesLayout>
      <NewIncomePage />
    </IncomesLayout>,
  );

  expect(screen.getByRole("heading", { name: /cargar ingreso/i })).toBeVisible();
  expect(screen.getByText("Venta nueva")).toBeVisible();
  expect(screen.getByAltText("Bastardos Barbería")).toBeVisible();
  expect(
    screen.getByRole("link", { name: /volver a ingresos/i }),
  ).toHaveAttribute("href", "/incomes");
  expect(screen.getByRole("button", { name: /revisar ingreso/i })).toBeVisible();
  expect(metadata.title).toBe("Cargar ingreso");
  expect(consoleError).not.toHaveBeenCalled();
  consoleError.mockRestore();
});
