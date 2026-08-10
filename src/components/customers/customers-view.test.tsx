import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";

import { CustomersView } from "@/components/customers/customers-view";
import customersMock from "@/data/customers.mock.json";
import { authorizeCustomerCatalogData } from "@/lib/customers/customer-catalog";

const data = authorizeCustomerCatalogData(customersMock);

it("renders metrics and responsive customer representations", () => {
  render(<CustomersView data={data} canManage />);
  const summary = screen.getByRole("region", { name: "Resumen de clientes" });
  expect(summary).toBeVisible();
  expect(summary.firstElementChild).toHaveClass(
    "transition-all",
    "hover:-translate-y-0.5",
    "hover:shadow-lg",
  );
  expect(screen.getByRole("table", { name: "Listado de clientes" })).toBeVisible();
  expect(screen.getByRole("list", { name: "Listado móvil de clientes" })).toBeVisible();
  expect(screen.getAllByText("Lucas Ferreyra")).toHaveLength(2);
  expect(screen.getAllByText(/18 visitas/)).toHaveLength(2);
});

it("searches customers and sorts by visits", async () => {
  const user = userEvent.setup();
  render(<CustomersView data={data} canManage />);
  await user.type(screen.getByRole("searchbox", { name: "Buscar clientes" }), "lucas");
  expect(screen.getAllByText("Lucas Ferreyra")).toHaveLength(2);
  expect(screen.queryAllByText("Martín Sosa")).toHaveLength(0);
  await user.clear(screen.getByRole("searchbox", { name: "Buscar clientes" }));
  await user.selectOptions(screen.getByLabelText("Ordenar clientes"), "visits-desc");
  const rows = within(screen.getByRole("table", { name: "Listado de clientes" })).getAllByRole("row");
  expect(rows[1]).toHaveTextContent("Juan Córdoba");
});

it("creates customers in memory with visits read-only", async () => {
  const user = userEvent.setup();
  render(<CustomersView data={data} canManage />);
  await user.click(screen.getByRole("button", { name: "Nuevo cliente" }));
  const dialog = screen.getByRole("dialog");
  await user.type(within(dialog).getByLabelText("Nombre"), "Ana");
  await user.type(within(dialog).getByLabelText("Apellido"), "Díaz");
  await user.type(within(dialog).getByLabelText("Email"), "ana@mail.com");
  await user.type(within(dialog).getByLabelText("Teléfono"), "3515550200");
  expect(within(dialog).queryByLabelText("Visitas")).not.toBeInTheDocument();
  await user.click(within(dialog).getByRole("button", { name: "Crear cliente" }));
  expect(screen.getAllByText("Ana Díaz")).toHaveLength(2);
  expect(screen.getByRole("status", { name: "Cliente añadido correctamente." })).toBeVisible();
});

it("edits a customer without changing their visits", async () => {
  const user = userEvent.setup();
  render(<CustomersView data={data} canManage />);

  await user.click(screen.getAllByRole("button", { name: "Gestionar Lucas Ferreyra" })[0]);
  const dialog = screen.getByRole("dialog");
  const firstName = within(dialog).getByLabelText("Nombre");
  await user.clear(firstName);
  await user.type(firstName, "Luciano");
  await user.click(within(dialog).getByRole("button", { name: "Guardar cambios" }));

  expect(screen.getAllByText("Luciano Ferreyra")).toHaveLength(2);
  expect(screen.getAllByText(/18 visitas/)).toHaveLength(2);
  expect(screen.getByRole("status", { name: "Cliente actualizado correctamente." })).toBeVisible();
});

it("rejects duplicate customer contact data", async () => {
  const user = userEvent.setup();
  render(<CustomersView data={data} canManage />);

  await user.click(screen.getByRole("button", { name: "Nuevo cliente" }));
  const dialog = screen.getByRole("dialog");
  await user.type(within(dialog).getByLabelText("Nombre"), "Ana");
  await user.type(within(dialog).getByLabelText("Apellido"), "Díaz");
  await user.type(within(dialog).getByLabelText("Email"), data.customers[0].email);
  await user.type(within(dialog).getByLabelText("Teléfono"), "3515550200");
  await user.click(within(dialog).getByRole("button", { name: "Crear cliente" }));

  expect(within(dialog).getByRole("alert")).toHaveTextContent(
    "Ya existe un cliente con ese email.",
  );
});

it("explains that customer emails cannot contain accents or ñ", async () => {
  const user = userEvent.setup();
  render(<CustomersView data={data} canManage />);

  await user.click(screen.getByRole("button", { name: "Nuevo cliente" }));
  const dialog = screen.getByRole("dialog");
  await user.type(within(dialog).getByLabelText("Nombre"), "Pedro");
  await user.type(within(dialog).getByLabelText("Apellido"), "Castañeda");
  await user.type(
    within(dialog).getByLabelText("Email"),
    "pedro.castañeda@gmail.com",
  );
  await user.type(within(dialog).getByLabelText("Teléfono"), "3515550200");
  await user.click(within(dialog).getByRole("button", { name: "Crear cliente" }));

  expect(within(dialog).getByRole("alert")).toHaveTextContent(
    "Ingresá un email válido, sin ñ ni acentos.",
  );
});

it("keeps employees read-only", () => {
  render(<CustomersView data={data} canManage={false} />);
  expect(screen.queryByRole("button", { name: "Nuevo cliente" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Gestionar Lucas Ferreyra/ })).not.toBeInTheDocument();
});
