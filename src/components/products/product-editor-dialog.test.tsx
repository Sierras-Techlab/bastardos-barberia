import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { ProductEditorDialog } from "@/components/products/product-editor-dialog";
import productsMock from "@/data/products.mock.json";
import { authorizeProductCatalogData } from "@/lib/products/product-catalog";

const products = authorizeProductCatalogData(productsMock).products;
const categories = [
  { id: "20000000-0000-4000-8000-000000000001", name: "Cuidado capilar", isActive: true },
  { id: "20000000-0000-4000-8000-000000000002", name: "Peinado y styling", isActive: true },
  { id: "20000000-0000-4000-8000-000000000004", name: "Fragancias", isActive: false },
];

it("submits a valid new product with numeric values", async () => {
  const user = userEvent.setup();
  const onSave = vi.fn();
  render(
    <ProductEditorDialog
      mode="create"
      product={null}
      products={products}
      categories={categories}
      onClose={vi.fn()}
      onSave={onSave}
    />,
  );

  await user.type(screen.getByLabelText("Nombre"), "Pomada mate");
  await user.selectOptions(
    screen.getByLabelText("Categoría"),
    "20000000-0000-4000-8000-000000000002",
  );
  await user.type(screen.getByLabelText("Precio"), "14500");
  await user.type(screen.getByLabelText("Stock inicial"), "6");
  await user.click(screen.getByRole("button", { name: "Crear producto" }));

  expect(onSave).toHaveBeenCalledWith({
    name: "Pomada mate",
    categoryId: "20000000-0000-4000-8000-000000000002",
    price: 14500,
    stock: 6,
  });
});

it("rejects a normalized duplicate product name", async () => {
  const user = userEvent.setup();
  render(
    <ProductEditorDialog
      mode="create"
      product={null}
      products={products}
      categories={categories}
      onClose={vi.fn()}
      onSave={vi.fn()}
    />,
  );

  await user.type(screen.getByLabelText("Nombre"), " hunter cream ");
  await user.type(screen.getByLabelText("Precio"), "10000");
  await user.type(screen.getByLabelText("Stock inicial"), "1");
  await user.click(screen.getByRole("button", { name: "Crear producto" }));

  expect(
    screen.getByText("Ya existe un producto con ese nombre."),
  ).toBeVisible();
});

it("edits catalog fields while preserving stock", async () => {
  const user = userEvent.setup();
  const onSave = vi.fn();
  render(
    <ProductEditorDialog
      mode="edit"
      product={products[0]}
      products={products}
      categories={categories}
      onClose={vi.fn()}
      onSave={onSave}
    />,
  );

  await user.clear(screen.getByLabelText("Nombre"));
  await user.type(screen.getByLabelText("Nombre"), "Hunter Matte");
  await user.clear(screen.getByLabelText("Precio"));
  await user.type(screen.getByLabelText("Precio"), "32000");
  expect(screen.queryByLabelText("Stock inicial")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({ name: "Hunter Matte", price: 32000, stock: 8 }),
  );
});

it("preserves the draft and displays asynchronous save failures", async () => {
  const user = userEvent.setup();
  const onSave = vi.fn().mockRejectedValue(new Error("No se pudo guardar."));
  render(
    <ProductEditorDialog
      mode="create"
      product={null}
      products={products}
      categories={categories}
      onClose={vi.fn()}
      onSave={onSave}
    />,
  );

  await user.type(screen.getByLabelText("Nombre"), "Pomada mate");
  await user.type(screen.getByLabelText("Precio"), "14500");
  await user.type(screen.getByLabelText("Stock inicial"), "6");
  await user.click(screen.getByRole("button", { name: "Crear producto" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "No se pudo guardar.",
  );
  expect(screen.getByLabelText("Nombre")).toHaveValue("Pomada mate");
});

it("only offers active categories for product creation", () => {
  render(
    <ProductEditorDialog
      mode="create"
      product={null}
      products={products}
      categories={categories}
      onClose={vi.fn()}
      onSave={vi.fn()}
    />,
  );

  expect(screen.getByRole("option", { name: "Cuidado capilar" })).toBeVisible();
  expect(screen.queryByRole("option", { name: "Fragancias" })).not.toBeInTheDocument();
});
