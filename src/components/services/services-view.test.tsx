import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { ServicesView } from "@/components/services/services-view";
import { DashboardToaster } from "@/components/ui/dashboard-toaster";
import servicesMock from "@/data/services.mock.json";
import { authorizeServiceCatalogData } from "@/lib/services/service-catalog";
import type { ServiceClient } from "@/lib/services/client";

const data = authorizeServiceCatalogData(servicesMock);
const expectToast = (message: string) =>
  expect(screen.getByText(message).closest("[data-sonner-toast]")).not.toBeNull();
const createServiceClient = (): ServiceClient => ({
  create: vi.fn(async (input) => ({ id: "10000000-0000-4000-8000-000000000009", ...input, isActive: true })),
  update: vi.fn(async (id, input) => ({
    ...(data.services.find((service) => service.id === id) ?? {
      id,
      name: "Corte premium",
      price: 22000,
      isActive: true,
    }),
    ...input,
    id,
  })),
  remove: vi.fn(async (id) => ({ id })),
});

it("renders metrics and visual service cards", () => {
  render(<ServicesView data={data} canManage />);
  expect(screen.getByRole("region", { name: "Resumen de servicios" })).toBeVisible();
  expect(screen.getByRole("list", { name: "Catálogo de servicios" })).toHaveClass(
    "lg:grid-cols-3",
  );
  expect(screen.getByRole("region", { name: "Filtros de servicios" }).firstElementChild).toHaveClass(
    "lg:grid-cols-[minmax(15rem,1fr)_12rem_12rem_auto]",
  );
  expect(screen.getByText("3 activos")).toBeVisible();
  expect(screen.getByText("Corte de pelo y perfilado de cejas")).toBeVisible();
  expect(screen.getAllByRole("listitem")[0]).toHaveClass("min-h-44", "p-4");
  expect(screen.getAllByText("Activo")[0]).toHaveClass(
    "bg-emerald-500",
    "text-white",
  );
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
});

it("searches, sorts and clears the visual catalog", async () => {
  const user = userEvent.setup();
  render(<ServicesView data={data} canManage />);
  await user.type(screen.getByRole("searchbox", { name: "Buscar servicios" }), "barba");
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
  await user.selectOptions(screen.getByLabelText("Ordenar servicios"), "price-asc");
  await user.click(screen.getByRole("button", { name: "Limpiar filtros" }));
  expect(screen.getAllByRole("listitem")).toHaveLength(3);
});

it("shows an empty state for unmatched filters", async () => {
  const user = userEvent.setup();
  render(<ServicesView data={data} canManage />);
  await user.type(screen.getByRole("searchbox", { name: "Buscar servicios" }), "tintura");
  expect(screen.getByText("No encontramos servicios")).toBeVisible();
});

it("keeps employees read-only and hides inactive services", () => {
  render(<ServicesView data={{ ...data, services: [{ ...data.services[0], isActive: false }, ...data.services.slice(1)] }} canManage={false} />);
  expect(screen.queryByText("Corte de pelo y perfilado de cejas")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Nuevo servicio" })).not.toBeInTheDocument();
});

it("creates and edits services through persistence", async () => {
  const user = userEvent.setup();
  const client = createServiceClient();
  render(<><ServicesView data={data} canManage serviceClient={client} /><DashboardToaster /></>);
  await user.click(screen.getByRole("button", { name: "Nuevo servicio" }));
  let dialog = screen.getByRole("dialog");
  await user.type(within(dialog).getByLabelText("Nombre"), "Corte premium");
  await user.type(within(dialog).getByLabelText("Precio"), "22000");
  await user.click(within(dialog).getByRole("button", { name: "Crear servicio" }));
  expect(screen.getByText("Corte premium")).toBeVisible();
  await waitFor(() => expectToast("Servicio añadido correctamente."));

  await user.click(screen.getByRole("button", { name: "Gestionar Corte premium" }));
  expect(await screen.findByRole("menu")).toHaveClass("w-44");
  await user.click(await screen.findByRole("menuitem", { name: "Editar" }));
  dialog = screen.getByRole("dialog");
  const price = within(dialog).getByLabelText("Precio");
  await user.clear(price);
  await user.type(price, "23000");
  await user.click(within(dialog).getByRole("button", { name: "Guardar cambios" }));
  const editedCard = screen.getByText("Corte premium").closest("li");
  expect(editedCard).not.toBeNull();
  expect(within(editedCard!).getByText(/23\.000/)).toBeVisible();
  await waitFor(() => expectToast("Servicio actualizado correctamente."));
  expect(client.create).toHaveBeenCalledOnce();
  expect(client.update).toHaveBeenCalledOnce();
});

it("changes service status after confirmation", async () => {
  const user = userEvent.setup();
  const client = createServiceClient();
  render(<><ServicesView data={data} canManage serviceClient={client} /><DashboardToaster /></>);
  await user.click(screen.getByRole("button", { name: "Gestionar Barba" }));
  await user.click(await screen.findByRole("menuitem", { name: "Desactivar" }));
  await user.click(screen.getByRole("button", { name: "Desactivar servicio" }));
  expect(screen.getByText("Inactivo")).toHaveClass("bg-orange-500", "text-white");
  await waitFor(() => expectToast("Servicio desactivado correctamente."));
  expect(client.update).toHaveBeenCalledWith(data.services[1].id, { isActive: false });
});

it("deletes a persisted service only after confirmation", async () => {
  const user = userEvent.setup();
  const client = createServiceClient();
  render(<><ServicesView data={data} canManage serviceClient={client} /><DashboardToaster /></>);

  await user.click(screen.getByRole("button", { name: "Gestionar Barba" }));
  await user.click(await screen.findByRole("menuitem", { name: "Eliminar" }));
  expect(screen.getByText("Barba")).toBeVisible();

  await user.click(screen.getByRole("button", { name: "Eliminar servicio" }));
  expect(screen.queryByText("Barba")).not.toBeInTheDocument();
  await waitFor(() => expectToast("Servicio eliminado correctamente."));
  expect(client.remove).toHaveBeenCalledWith(data.services[1].id);
});

it("keeps the editor draft open when persistence fails", async () => {
  const user = userEvent.setup();
  const client = createServiceClient();
  vi.mocked(client.create).mockRejectedValue(new Error("Ya existe un servicio con ese nombre."));
  render(<ServicesView data={data} canManage serviceClient={client} />);
  await user.click(screen.getByRole("button", { name: "Nuevo servicio" }));
  await user.type(screen.getByLabelText("Nombre"), "Corte premium");
  await user.type(screen.getByLabelText("Precio"), "22000");
  await user.click(screen.getByRole("button", { name: "Crear servicio" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Ya existe un servicio con ese nombre.");
  expect(screen.getByLabelText("Nombre")).toHaveValue("Corte premium");
});
