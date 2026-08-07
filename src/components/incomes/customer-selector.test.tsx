import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { CustomerSelector } from "./customer-selector";

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
