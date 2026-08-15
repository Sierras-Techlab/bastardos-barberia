import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { ProductCategoriesDialog } from "@/components/products/product-categories-dialog";
import { DashboardToaster } from "@/components/ui/dashboard-toaster";

const active = {
  id: "20000000-0000-4000-8000-000000000001",
  name: "Cuidado capilar",
  isActive: true,
};
const inactive = {
  id: "20000000-0000-4000-8000-000000000002",
  name: "Fragancias",
  isActive: false,
};

it("creates, renames and replaces category records from API responses", async () => {
  const user = userEvent.setup();
  const created = { ...active, id: "20000000-0000-4000-8000-000000000003", name: "Accesorios" };
  const renamed = { ...active, name: "Cuidado del cabello" };
  const categoryClient = {
    create: vi.fn().mockResolvedValue(created),
    update: vi.fn().mockResolvedValue(renamed),
    deactivate: vi.fn(),
    remove: vi.fn(),
  };
  const onCategoriesChange = vi.fn();
  render(<><ProductCategoriesDialog categories={[active, inactive]} categoryClient={categoryClient} onCategoriesChange={onCategoriesChange} onClose={vi.fn()} /><DashboardToaster /></>);

  await user.type(screen.getByLabelText("Nueva categoría"), "Accesorios");
  await user.click(screen.getByRole("button", { name: "Agregar categoría" }));
  expect(categoryClient.create).toHaveBeenCalledWith({ name: "Accesorios" });
  expect(onCategoriesChange).toHaveBeenCalledWith([active, inactive, created]);
  expect(await screen.findByText("Categoría creada correctamente.")).toBeVisible();

  await user.click(screen.getByRole("button", { name: "Editar Cuidado capilar" }));
  const dialog = screen.getByRole("dialog");
  const rename = within(dialog).getByLabelText("Nombre de la categoría");
  await user.clear(rename);
  await user.type(rename, "Cuidado del cabello");
  await user.click(within(dialog).getByRole("button", { name: "Guardar nombre" }));
  expect(categoryClient.update).toHaveBeenCalledWith(active.id, { name: "Cuidado del cabello" });
  expect(onCategoriesChange).toHaveBeenLastCalledWith([renamed, inactive, created]);
  expect(await screen.findByText("Categoría actualizada correctamente.")).toBeVisible();
});

it("shows a safe conflict and supports reactivation", async () => {
  const user = userEvent.setup();
  const categoryClient = {
    create: vi.fn(),
    update: vi.fn().mockResolvedValue({ ...inactive, isActive: true }),
    deactivate: vi.fn().mockRejectedValue(
      Object.assign(new Error("No podés desactivar una categoría que tiene productos activos."), {
        code: "PRODUCT_CATEGORY_IN_USE",
      }),
    ),
    remove: vi.fn(),
  };
  render(<><ProductCategoriesDialog categories={[active, inactive]} categoryClient={categoryClient} onCategoriesChange={vi.fn()} onClose={vi.fn()} /><DashboardToaster /></>);

  await user.click(screen.getByRole("button", { name: "Desactivar Cuidado capilar" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("productos activos");
  const deactivate = screen.getByRole("button", { name: "Desactivar Cuidado capilar" });
  expect(deactivate).toBeDisabled();
  await user.click(deactivate);
  expect(categoryClient.deactivate).toHaveBeenCalledOnce();

  await user.click(screen.getByRole("button", { name: "Ver desactivadas (1)" }));
  await user.click(screen.getByRole("button", { name: "Reactivar Fragancias" }));
  expect(categoryClient.update).toHaveBeenCalledWith(inactive.id, { isActive: true });
  expect(await screen.findByText("Categoría reactivada correctamente.")).toBeVisible();
});

it("separates active categories and removes one only after confirmation", async () => {
  const user = userEvent.setup();
  const categoryClient = {
    create: vi.fn(),
    update: vi.fn(),
    deactivate: vi.fn(),
    remove: vi.fn().mockResolvedValue({ id: inactive.id }),
  };
  const onCategoriesChange = vi.fn();

  render(
    <>
      <ProductCategoriesDialog
        categories={[active, inactive]}
        categoryClient={categoryClient}
        onCategoriesChange={onCategoriesChange}
        onClose={vi.fn()}
      />
      <DashboardToaster />
    </>,
  );

  expect(screen.getByTestId(`product-category-card-${active.id}`)).toBeVisible();
  expect(screen.queryByTestId(`product-category-card-${inactive.id}`)).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Ver desactivadas (1)" }));
  await user.click(screen.getByRole("button", { name: "Eliminar Fragancias" }));
  expect(categoryClient.remove).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Eliminar categoría" }));

  expect(categoryClient.remove).toHaveBeenCalledWith(inactive.id);
  expect(onCategoriesChange).toHaveBeenCalledWith([active]);
  expect(await screen.findByText("Categoría eliminada correctamente.")).toBeVisible();
});

it("keeps the three category actions in one compact accessible group", () => {
  const categoryClient = {
    create: vi.fn(),
    update: vi.fn(),
    deactivate: vi.fn(),
    remove: vi.fn(),
  };

  render(
    <ProductCategoriesDialog
      categories={[active]}
      categoryClient={categoryClient}
      onCategoriesChange={vi.fn()}
      onClose={vi.fn()}
    />,
  );

  const actions = screen.getByRole("group", {
    name: "Acciones para Cuidado capilar",
  });
  expect(within(actions).getAllByRole("button")).toHaveLength(3);
  expect(actions).toHaveClass("flex");
});
