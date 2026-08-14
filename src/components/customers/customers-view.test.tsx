import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { CustomersView } from "@/components/customers/customers-view";
import { DashboardToaster } from "@/components/ui/dashboard-toaster";
import customersMock from "@/data/customers.mock.json";
import { authorizeCustomerCatalogData } from "@/lib/customers/customer-catalog";
import type { CustomerClient } from "@/lib/customers/client";

const data = authorizeCustomerCatalogData(customersMock);
const client = (): CustomerClient => ({
  create: vi.fn(async (input) => ({ id: "10000000-0000-4000-8000-000000000099", ...input, visits: 0, createdAt: "2026-08-11T12:00:00.000Z" })),
  update: vi.fn(async (id, input) => ({ ...(data.customers.find((customer) => customer.id === id) ?? data.customers[0]), ...input, id })),
  remove: vi.fn(async (id) => ({ id })),
  listVisits: vi.fn(async () => ({ items: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } })),
});

it("renders metrics and responsive customer representations", () => {
  render(<CustomersView data={data} canDelete />);
  expect(screen.getByRole("region", { name: "Resumen de clientes" })).toBeVisible();
  expect(screen.getByRole("table", { name: "Listado de clientes" })).toBeVisible();
  expect(screen.getByRole("list", { name: "Listado móvil de clientes" })).toBeVisible();
  expect(screen.getAllByText("Lucas Ferreyra")).toHaveLength(2);
});

it("searches customers and sorts by visits", async () => {
  const user = userEvent.setup(); render(<CustomersView data={data} canDelete />);
  await user.type(screen.getByRole("searchbox", { name: "Buscar clientes" }), "lucas");
  expect(screen.getAllByText("Lucas Ferreyra")).toHaveLength(2);
  await user.clear(screen.getByRole("searchbox", { name: "Buscar clientes" }));
  await user.selectOptions(screen.getByLabelText("Ordenar clientes"), "visits-desc");
  expect(within(screen.getByRole("table")).getAllByRole("row")[1]).toHaveTextContent("Juan Córdoba");
});

it("creates and edits through persistence without editing visits", async () => {
  const user = userEvent.setup(); const customerClient = client();
  render(<><CustomersView data={data} canDelete customerClient={customerClient} /><DashboardToaster /></>);
  await user.click(screen.getByRole("button", { name: "Nuevo cliente" }));
  let dialog = screen.getByRole("dialog");
  await user.type(within(dialog).getByLabelText("Nombre"), "Ana");
  await user.type(within(dialog).getByLabelText("Apellido"), "Díaz");
  await user.type(within(dialog).getByLabelText("Teléfono"), "3515550200");
  expect(within(dialog).queryByLabelText("Visitas")).not.toBeInTheDocument();
  await user.click(within(dialog).getByRole("button", { name: "Crear cliente" }));
  expect(await screen.findAllByText("Ana Díaz")).toHaveLength(2);
  expect(customerClient.create).toHaveBeenCalledWith(expect.objectContaining({ email: null }));

  await user.click(screen.getAllByRole("button", { name: "Editar Lucas Ferreyra" })[0]);
  dialog = screen.getByRole("dialog"); const firstName = within(dialog).getByLabelText("Nombre");
  await user.clear(firstName); await user.type(firstName, "Luciano");
  await user.click(within(dialog).getByRole("button", { name: "Guardar cambios" }));
  expect(await screen.findAllByText("Luciano Ferreyra")).toHaveLength(2);
  expect(screen.getAllByText(/18 visitas/)).toHaveLength(2);
  expect(vi.mocked(customerClient.update).mock.calls[0]?.[1]).toHaveProperty("fixedSchedule", null);
});

it("allows employees to create and edit but hides deletion", () => {
  render(<CustomersView data={data} canDelete={false} />);
  expect(screen.getByRole("button", { name: "Nuevo cliente" })).toBeVisible();
  expect(screen.getAllByRole("button", { name: "Editar Lucas Ferreyra" })).toHaveLength(2);
  expect(screen.queryByRole("button", { name: "Eliminar Lucas Ferreyra" })).not.toBeInTheDocument();
});

it("manager deletion requires confirmation", async () => {
  const user = userEvent.setup(); const customerClient = client();
  render(<><CustomersView data={data} canDelete customerClient={customerClient} /><DashboardToaster /></>);
  await user.click(screen.getAllByRole("button", { name: "Eliminar Lucas Ferreyra" })[0]);
  await user.click(screen.getByRole("button", { name: "Eliminar cliente" }));
  await waitFor(() => expect(customerClient.remove).toHaveBeenCalledWith(data.customers.find(({ firstName }) => firstName === "Lucas")!.id));
  expect(screen.queryByText("Cliente eliminado correctamente.")).toBeInTheDocument();
});

it("does not render a mailto action for missing email", () => {
  render(<CustomersView data={{ customers: [{ ...data.customers[0], email: null }] }} canDelete={false} />);
  expect(document.querySelector('a[href^="mailto:"]')).toBeNull();
});

it("opens visit details from desktop and mobile visit controls", async () => {
  const user = userEvent.setup();
  const customerClient = client();
  vi.mocked(customerClient.listVisits).mockResolvedValue({
    items: [{
      id: "20000000-0000-4000-8000-000000000001",
      occurredAt: "2026-08-13T14:00:00.000Z",
      businessDate: "2026-08-13",
      totalSpent: 19000,
      items: [{ type: "service", name: "Corte clásico", quantity: 1, unitPrice: 19000, subtotal: 19000 }],
    }],
    pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
  });
  render(<CustomersView data={data} canDelete customerClient={customerClient} />);

  const controls = screen.getAllByRole("button", { name: "Ver 18 visitas de Lucas Ferreyra" });
  expect(controls).toHaveLength(2);
  await user.click(controls[0]);
  expect(await screen.findByText("1 × Corte clásico")).toBeVisible();
});
