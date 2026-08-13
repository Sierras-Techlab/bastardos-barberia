import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { FixedCustomersCard } from "@/components/dashboard/fixed-customers-card";
import type { FixedCustomerOccurrence } from "@/types/fixed-customer";

const occurrences: FixedCustomerOccurrence[] = [
  { id: "occ-old", customer: { id: "customer-old", firstName: "Visita", lastName: "Pasada" }, date: "2026-08-12", time: "08:00", status: "pending" },
  { id: "occ-2", customer: { id: "customer-2", firstName: "Pedro", lastName: "Castañeda" }, date: "2026-08-13", time: "17:30", status: "missed" },
  { id: "occ-1", customer: { id: "customer-1", firstName: "Juan", lastName: "Cruz" }, date: "2026-08-13", time: "10:00", status: "pending" },
  { id: "occ-3", customer: { id: "customer-3", firstName: "Ana", lastName: "Pérez" }, date: "2026-08-14", time: "09:00", status: "attended" },
];

it("sorts fixed occurrences and renders their current states", () => {
  const { container } = render(<FixedCustomersCard occurrences={occurrences} dateFrom="2026-08-13" />);
  const surface = container.querySelector("section");
  expect(surface).toHaveClass("rounded-3xl", "border", "border-black/5");
  expect(surface?.className).toMatch(/\bshadow-/);
  const rows = screen.getAllByRole("listitem");
  expect(within(rows[0]).getByText("Juan Cruz")).toBeVisible();
  expect(within(rows[1]).getByText("Pedro Castañeda")).toBeVisible();
  expect(within(rows[2]).getByText("Ana Pérez")).toBeVisible();
  expect(within(rows[0]).getByRole("button", { name: "Marcar ausencia de Juan Cruz" })).toHaveTextContent("No asistió");
  expect(within(rows[0]).getByRole("button", { name: "Marcar asistencia de Juan Cruz" })).toHaveTextContent("Asistió");
  expect(within(rows[1]).getByText("No asistió")).toBeVisible();
  expect(within(rows[2]).getByText("Asistió")).toBeVisible();
  expect(screen.getByRole("link", { name: "Gestionar clientes fijos" })).toHaveAttribute("href", "/customers");
});

it("changes only the selected pending occurrence", async () => {
  const user = userEvent.setup();
  const onStatusChange = vi.fn();
  render(<FixedCustomersCard occurrences={occurrences} dateFrom="2026-08-13" onStatusChange={onStatusChange} />);
  await user.click(screen.getByRole("button", { name: "Marcar asistencia de Juan Cruz" }));
  expect(onStatusChange).toHaveBeenCalledWith("occ-1", "attended");
  await screen.findByText("Juan Cruz");
  expect(screen.queryByRole("button", { name: "Marcar asistencia de Juan Cruz" })).not.toBeInTheDocument();
  expect(screen.getByText("Juan Cruz").closest("li")).toHaveTextContent("Asistió");
  expect(screen.getByText("Pedro Castañeda").closest("li")).toHaveTextContent("No asistió");
});

it("renders a useful empty state", () => {
  render(<FixedCustomersCard occurrences={[]} />);
  expect(screen.getByText("No hay clientes fijos próximos")).toBeVisible();
  expect(screen.getByRole("link", { name: "Gestionar clientes" })).toHaveAttribute("href", "/customers");
});
