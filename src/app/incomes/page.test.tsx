import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import IncomesPage, { metadata } from "./page";
import IncomesLayout from "./layout";

it("composes the Bastardos income history route", () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

  render(
    <IncomesLayout>
      <IncomesPage />
    </IncomesLayout>,
  );

  expect(screen.getByRole("heading", { name: /ingresos/i })).toBeVisible();
  expect(screen.getByText(/historial de ventas/i)).toBeVisible();
  expect(screen.getByAltText("Bastardos Barbería")).toBeVisible();
  expect(screen.getByRole("link", { name: /cargar ingreso/i })).toHaveAttribute(
    "href",
    "/incomes/new",
  );
  expect(screen.getByRole("link", { name: /^ingresos$/i })).toHaveAttribute(
    "href",
    "/incomes",
  );
  expect(metadata.title).toBe("Ingresos");
  expect(consoleError).not.toHaveBeenCalled();

  consoleError.mockRestore();
});
