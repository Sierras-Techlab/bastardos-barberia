import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { CustomerSelector } from "./customer-selector";
import type { CustomerClient } from "@/lib/customers/client";

const customers = [
  { id: "customer-1", firstName: "Tomás", lastName: "Pereyra" },
  { id: "customer-2", firstName: "Lucas", lastName: "Romero" },
];

it("searches, selects, and clears an optional customer", async () => {
  const onChange = vi.fn();
  const user = userEvent.setup();
  const { rerender } = render(
    <CustomerSelector customers={customers} value={null} onChange={onChange} />,
  );

  await user.type(
    screen.getByRole("combobox", { name: /cliente opcional/i }),
    "tom",
  );

  expect(
    screen.queryByRole("button", { name: /seleccionar lucas romero/i }),
  ).not.toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: /seleccionar tomás pereyra/i }),
  );
  expect(onChange).toHaveBeenCalledWith("customer-1");

  rerender(
    <CustomerSelector
      customers={customers}
      value="customer-1"
      onChange={onChange}
    />,
  );
  expect(screen.getByText("Tomás Pereyra")).toBeVisible();

  await user.click(screen.getByRole("button", { name: /quitar cliente/i }));
  expect(onChange).toHaveBeenLastCalledWith(null);
});

it("creates and immediately selects a missing customer", async () => {
  const user = userEvent.setup();
  const created = { id: "10000000-0000-4000-8000-000000000001", firstName: "Ana", lastName: "Pérez", phone: "3515550101", email: null, visits: 0, createdAt: "2026-08-11T12:00:00.000Z" };
  const customerClient: Pick<CustomerClient, "create"> = { create: vi.fn().mockResolvedValue(created) };
  const onCreated = vi.fn();
  render(<CustomerSelector customers={customers} value={null} onChange={vi.fn()} onCustomerCreated={onCreated} customerClient={customerClient} />);
  await user.type(screen.getByRole("combobox", { name: /cliente opcional/i }), "Ana");
  await user.click(screen.getByRole("button", { name: /crear cliente/i }));
  await user.type(screen.getByLabelText("Nombre"), "Ana");
  await user.type(screen.getByLabelText("Apellido"), "Pérez");
  await user.type(screen.getByLabelText("Teléfono"), "3515550101");
  await user.click(screen.getByRole("button", { name: "Crear cliente" }));
  expect(onCreated).toHaveBeenCalledWith(created);
});
