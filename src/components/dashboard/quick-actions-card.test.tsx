import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { QuickActionsCard } from "@/components/dashboard/quick-actions-card";

it("renders the four real quick actions and leaves expenses in manager navigation", () => {
  const { container } = render(<QuickActionsCard />);
  const surface = container.querySelector("section");
  expect(surface).toHaveClass("rounded-3xl", "border", "border-white/10");
  expect(surface?.className).toMatch(/\bshadow-/);
  expect(screen.getByRole("link", { name: "Ver ingresos" }).parentElement).toHaveClass("gap-3");
  expect(screen.getByRole("link", { name: "Ver ingresos" })).toHaveClass("border", "border-white/10");
  expect(screen.getAllByRole("link")).toHaveLength(4);
  expect(screen.getByRole("link", { name: "Cargar ingreso" })).toHaveAttribute("href", "/incomes/new");
  expect(screen.getByRole("link", { name: "Ver ingresos" })).toHaveAttribute("href", "/incomes");
  expect(screen.getByRole("link", { name: "Gestionar clientes" })).toHaveAttribute("href", "/customers");
  expect(screen.getByRole("link", { name: "Ver productos" })).toHaveAttribute("href", "/products");
  expect(screen.queryByRole("button", { name: "Registrar gasto" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Cerrar caja" })).not.toBeInTheDocument();
  expect(container.querySelector('a[href="#"]')).toBeNull();
});

it("omits income creation when the cash register is closed", () => {
  render(<QuickActionsCard canCreateIncome={false} />);
  expect(screen.queryByRole("link", { name: "Cargar ingreso" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Ver ingresos" })).toBeVisible();
  expect(screen.getByText(/Caja de hoy está cerrada/i)).toBeVisible();
});
