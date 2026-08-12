import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";

import { QuickActionsCard } from "@/components/dashboard/quick-actions-card";
import { DashboardToaster } from "@/components/ui/dashboard-toaster";

it("renders six actions with four exact destinations and no dead links", () => {
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
  expect(screen.getByRole("button", { name: "Registrar gasto" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Cerrar caja" })).toBeVisible();
  expect(container.querySelector('a[href="#"]')).toBeNull();
});

it("explains that future actions are not available yet", async () => {
  const user = userEvent.setup();
  render(<><QuickActionsCard /><DashboardToaster /></>);
  await user.click(screen.getByRole("button", { name: "Registrar gasto" }));
  expect(await screen.findByText("Esta función estará disponible próximamente")).toBeVisible();
});
