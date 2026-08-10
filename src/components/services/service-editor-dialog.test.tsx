import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { ServiceEditorDialog } from "@/components/services/service-editor-dialog";
import servicesMock from "@/data/services.mock.json";
import { authorizeServiceCatalogData } from "@/lib/services/service-catalog";

const services = authorizeServiceCatalogData(servicesMock).services;

it("validates required fields and normalized duplicate names", async () => {
  const user = userEvent.setup();
  render(<ServiceEditorDialog mode="create" service={null} services={services} onClose={vi.fn()} onSave={vi.fn()} />);
  await user.click(screen.getByRole("button", { name: "Crear servicio" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Ingresá el nombre del servicio.");
  await user.type(screen.getByLabelText("Nombre"), ` ${services[0].name.toUpperCase()} `);
  await user.type(screen.getByLabelText("Precio"), "20000");
  await user.click(screen.getByRole("button", { name: "Crear servicio" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Ya existe un servicio con ese nombre.");
});

it("submits an edited integer price", async () => {
  const user = userEvent.setup();
  const onSave = vi.fn();
  render(<ServiceEditorDialog mode="edit" service={services[1]} services={services} onClose={vi.fn()} onSave={onSave} />);
  const price = screen.getByLabelText("Precio");
  await user.clear(price);
  await user.type(price, "14000");
  await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
  expect(onSave).toHaveBeenCalledWith({ name: "Barba", price: 14000 });
});
