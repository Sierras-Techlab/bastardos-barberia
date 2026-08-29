import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { ProductsView } from "@/components/products/products-view";
import { DashboardToaster } from "@/components/ui/dashboard-toaster";
import productsMock from "@/data/products.mock.json";
import { authorizeProductCatalogData } from "@/lib/products/product-catalog";

const data = authorizeProductCatalogData(productsMock);
const categories = Array.from(
  new Map(data.products.map((product) => [product.category.id, product.category])).values(),
);
const expectToast = (message: string) =>
  expect(screen.getByText(message).closest("[data-sonner-toast]")).not.toBeNull();

it("shows the catalog summary in desktop and mobile representations", () => {
  render(<ProductsView data={data} categories={categories} canManage />);

  expect(
    screen.getByRole("region", { name: /resumen de productos/i }),
  ).toBeVisible();
  expect(
    screen.getByRole("table", { name: /catálogo de productos/i }),
  ).toBeVisible();
  expect(
    screen.getByRole("table", { name: /catálogo de productos/i }).parentElement
      ?.parentElement?.parentElement,
  ).toHaveClass("xl:block");
  expect(
    screen.getByRole("list", { name: /catálogo móvil de productos/i }),
  ).toBeVisible();
  expect(
    screen.getByRole("list", { name: /catálogo móvil de productos/i }).parentElement,
  ).toHaveClass("xl:hidden");
  expect(screen.getAllByText("Hunter Cream")).toHaveLength(2);
  expect(screen.getAllByText(/30\.000/)).toHaveLength(2);
  expect(screen.getAllByText("Disponible").length).toBeGreaterThan(0);
  expect(screen.getAllByText("8 unidades")).toHaveLength(2);
  expect(screen.getAllByText("Stock bajo").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Sin stock").length).toBeGreaterThan(0);
});

it("filters by product name and restores the complete catalog", async () => {
  const user = userEvent.setup();
  render(<ProductsView data={data} categories={categories} canManage />);

  await user.type(
    screen.getByRole("searchbox", { name: /buscar productos/i }),
    "barba",
  );

  expect(screen.getAllByText("Aceite para barba")).toHaveLength(2);
  expect(screen.queryByText("Hunter Cream")).not.toBeInTheDocument();

  await user.clear(
    screen.getByRole("searchbox", { name: /buscar productos/i }),
  );

  expect(screen.getAllByText("Hunter Cream")).toHaveLength(2);
});

it("combines filters and clears an empty result", async () => {
  const user = userEvent.setup();
  render(<ProductsView data={data} categories={categories} canManage />);

  await user.selectOptions(
    screen.getByLabelText("Categoría"),
    "20000000-0000-4000-8000-000000000004",
  );
  await user.selectOptions(screen.getByLabelText("Estado de stock"), "available");

  expect(screen.getByText(/no encontramos productos/i)).toBeVisible();

  await user.click(
    screen.getByRole("button", { name: /limpiar filtros/i }),
  );

  expect(screen.getAllByText("Hunter Cream")).toHaveLength(2);
  expect(screen.getByLabelText("Categoría")).toHaveValue("all");
  expect(screen.getByLabelText("Estado de stock")).toHaveValue("all");
});

it("sorts desktop stock through ascending, descending and original order", async () => {
  const user = userEvent.setup();
  render(<ProductsView data={data} categories={categories} canManage />);
  const table = screen.getByRole("table", { name: /catálogo de productos/i });
  const names = () =>
    within(table)
      .getAllByRole("row")
      .slice(1)
      .map((row) =>
        within(row)
          .getAllByRole("cell")[0]
          .textContent?.replace("Inactivo", ""),
      );
  const original = data.products.map((product) => product.name);

  await user.click(screen.getByRole("button", { name: /ordenar por stock/i }));
  expect(names()[0]).toBe("Perfume");
  await user.click(screen.getByRole("button", { name: /ordenar por stock/i }));
  expect(names()[0]).toBe("Cera para pelo");
  await user.click(screen.getByRole("button", { name: /ordenar por stock/i }));
  expect(names()).toEqual(original);
});

it("sorts the mobile catalog by price", async () => {
  const user = userEvent.setup();
  render(<ProductsView data={data} categories={categories} canManage />);

  await user.selectOptions(screen.getByLabelText("Ordenar por"), "price-desc");

  const mobileList = screen.getByRole("list", {
    name: /catálogo móvil de productos/i,
  });
  expect(
    within(within(mobileList).getAllByRole("listitem")[0]).getByText(
      "Hunter Cream",
    ),
  ).toBeVisible();
});

it("keeps inactive products for managers and hides them from employees", () => {
  const { rerender } = render(<ProductsView data={data} categories={categories} canManage />);

  expect(screen.getAllByText("Perfume").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Inactivo").length).toBeGreaterThan(0);
  expect(screen.getByLabelText("Estado del producto")).toBeVisible();

  rerender(<ProductsView data={data} categories={categories} canManage={false} />);

  expect(screen.queryByText("Perfume")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Estado del producto")).not.toBeInTheDocument();
});

it("creates and edits products in memory, then resets on remount", async () => {
  const user = userEvent.setup();
  const createdProduct = {
    id: "10000000-0000-4000-8000-000000000099",
    name: "Pomada mate",
    category: categories[0]!,
    price: 14500,
    stock: 6,
    isActive: true,
  };
  const productClient = {
    create: vi.fn().mockResolvedValue(createdProduct),
    update: vi.fn().mockImplementation(
      async (_id: string, input: object) => ({ ...createdProduct, ...input }),
    ),
    adjustStock: vi.fn(),
  };
  const { unmount } = render(<><ProductsView data={data} categories={categories} canManage productClient={productClient} /><DashboardToaster /></>);

  await user.click(screen.getByRole("button", { name: "Nuevo producto" }));
  const createDialog = screen.getByRole("dialog");
  await user.type(within(createDialog).getByLabelText("Nombre"), "Pomada mate");
  await user.selectOptions(
    within(createDialog).getByLabelText("Categoría"),
    "20000000-0000-4000-8000-000000000002",
  );
  await user.type(within(createDialog).getByLabelText("Precio"), "14500");
  await user.type(within(createDialog).getByLabelText("Stock inicial"), "6");
  await user.click(
    within(createDialog).getByRole("button", { name: "Crear producto" }),
  );

  expect(productClient.create).toHaveBeenCalledWith({
    name: "Pomada mate",
    categoryId: "20000000-0000-4000-8000-000000000002",
    price: 14500,
    stock: 6,
  });
  expectToast("Producto añadido correctamente.");
  expect(screen.getAllByText("Pomada mate")).toHaveLength(2);
  expect(screen.getAllByText("6 unidades")).toHaveLength(2);

  const actionTrigger = screen.getAllByRole("button", {
    name: "Gestionar Pomada mate",
  })[0];
  await user.click(actionTrigger);
  await user.click(await screen.findByRole("menuitem", { name: "Editar" }));
  const editDialog = screen.getByRole("dialog");
  await user.clear(within(editDialog).getByLabelText("Nombre"));
  await user.type(
    within(editDialog).getByLabelText("Nombre"),
    "Pomada mate premium",
  );
  await user.click(
    within(editDialog).getByRole("button", { name: "Guardar cambios" }),
  );

  expect(productClient.update).toHaveBeenCalledWith(createdProduct.id, {
    name: "Pomada mate premium",
    categoryId: "20000000-0000-4000-8000-000000000002",
    price: 14500,
  });
  expectToast("Producto actualizado correctamente.");
  expect(screen.getAllByText("Pomada mate premium")).toHaveLength(2);
  expect(screen.getAllByText("6 unidades")).toHaveLength(2);

  unmount();
  render(<ProductsView data={data} categories={categories} canManage />);
  expect(screen.queryByText("Pomada mate premium")).not.toBeInTheDocument();
});

it("adjusts stock and deactivates products in memory", async () => {
  const user = userEvent.setup();
  const hunter = data.products[0];
  const productClient = {
    create: vi.fn(),
    update: vi.fn().mockResolvedValue({ ...hunter, isActive: false }),
    adjustStock: vi.fn().mockResolvedValue({ ...hunter, stock: 10 }),
  };
  render(<><ProductsView data={data} categories={categories} canManage productClient={productClient} /><DashboardToaster /></>);

  await user.click(
    screen.getAllByRole("button", { name: "Gestionar Hunter Cream" })[0],
  );
  await user.click(
    await screen.findByRole("menuitem", { name: "Ajustar stock" }),
  );
  await user.type(screen.getByLabelText("Cantidad"), "2");
  await user.click(screen.getByRole("button", { name: "Guardar ajuste" }));
  expect(productClient.adjustStock).toHaveBeenCalledWith(hunter.id, {
    kind: "entry",
    quantity: 2,
  });
  expectToast("Stock actualizado correctamente.");
  const hunterRow = within(
    screen.getByRole("table", { name: /catálogo de productos/i }),
  ).getByRole("row", { name: /Hunter Cream/ });
  expect(within(hunterRow).getByText("10 unidades")).toBeVisible();
  const hunterMobileItem = screen
    .getAllByText("Hunter Cream")[1]
    .closest("li");
  expect(hunterMobileItem).not.toBeNull();
  expect(within(hunterMobileItem!).getByText("10 unidades")).toBeVisible();

  await user.click(
    screen.getAllByRole("button", { name: "Gestionar Hunter Cream" })[0],
  );
  await user.click(await screen.findByRole("menuitem", { name: "Desactivar" }));
  await user.click(
    screen.getByRole("button", { name: "Desactivar producto" }),
  );
  expect(productClient.update).toHaveBeenCalledWith(hunter.id, {
    isActive: false,
  });
  expectToast("Producto desactivado correctamente.");
  expect(screen.getAllByText("Inactivo").length).toBeGreaterThan(2);
  expect(within(hunterRow).getByText("No disponible")).toBeVisible();
  expect(within(hunterRow).queryByText("Disponible")).not.toBeInTheDocument();
  expect(within(hunterMobileItem!).getByText("No disponible")).toBeVisible();
  expect(
    within(hunterMobileItem!).queryByText("Disponible"),
  ).not.toBeInTheDocument();
});

it("only exposes category administration to managers", () => {
  const { rerender } = render(
    <ProductsView data={data} categories={categories} canManage />,
  );
  expect(screen.getByRole("button", { name: "Administrar categorías" })).toBeVisible();

  rerender(<ProductsView data={data} categories={categories} canManage={false} />);
  expect(screen.queryByRole("button", { name: "Administrar categorías" })).not.toBeInTheDocument();
});

it("synchronizes renamed and deactivated categories into product cards and filters", async () => {
  const user = userEvent.setup();
  const fragrance = categories.find(
    (category) => category.id === "20000000-0000-4000-8000-000000000004",
  )!;
  const renamed = { ...fragrance, name: "Perfumería" };
  const categoryClient = {
    create: vi.fn(),
    update: vi.fn().mockResolvedValue(renamed),
    deactivate: vi.fn().mockResolvedValue({ ...renamed, isActive: false }),
    remove: vi.fn(),
  };
  render(
    <>
      <ProductsView
        data={data}
        categories={categories}
        canManage
        categoryClient={categoryClient}
      />
      <DashboardToaster />
    </>,
  );

  await user.click(screen.getByRole("button", { name: "Administrar categorías" }));
  await user.click(screen.getByRole("button", { name: "Editar Fragancias" }));
  const renameInput = screen.getByLabelText("Nombre de la categoría");
  await user.clear(renameInput);
  await user.type(renameInput, "Perfumería");
  await user.click(screen.getByRole("button", { name: "Guardar nombre" }));
  expect(await screen.findByText("Categoría actualizada correctamente.")).toBeVisible();

  await user.click(screen.getByRole("button", { name: "Desactivar Perfumería" }));
  expect(await screen.findByText("Categoría desactivada correctamente.")).toBeVisible();

  await user.click(screen.getByRole("button", { name: "Cerrar" }));
  await user.selectOptions(screen.getByLabelText("Categoría"), fragrance.id);
  expect(screen.getByLabelText("Categoría")).toHaveValue(fragrance.id);
  expect(screen.getByRole("option", { name: "Perfumería (inactiva)" })).toBeVisible();
  expect(
    within(screen.getByRole("table", { name: /catálogo de productos/i })).getByText(
      "Perfumería",
    ),
  ).toBeVisible();
  expect(
    within(screen.getByRole("list", { name: /catálogo móvil de productos/i })).getByText(
      "Perfumería",
    ),
  ).toBeVisible();
  expect(screen.getAllByText("Perfume")).toHaveLength(2);
});
