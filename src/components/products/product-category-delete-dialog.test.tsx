import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { ProductCategoryDeleteDialog } from "@/components/products/product-category-delete-dialog";
import { ProductCategoryApiError } from "@/lib/product-categories/client";

const category = {
  id: "20000000-0000-4000-8000-000000000001",
  name: "Cuidado capilar",
  isActive: true,
};

it("deletes the named category only after explicit confirmation", async () => {
  const user = userEvent.setup();
  const onConfirm = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();

  render(
    <ProductCategoryDeleteDialog
      category={category}
      onConfirm={onConfirm}
      onClose={onClose}
    />,
  );

  expect(screen.getByText(/“Cuidado capilar”/)).toBeVisible();
  expect(onConfirm).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Eliminar categoría" }));

  expect(onConfirm).toHaveBeenCalledOnce();
  expect(onClose).toHaveBeenCalledOnce();
});

it("cancels without deleting", async () => {
  const user = userEvent.setup();
  const onConfirm = vi.fn();
  const onClose = vi.fn();

  render(
    <ProductCategoryDeleteDialog
      category={category}
      onConfirm={onConfirm}
      onClose={onClose}
    />,
  );

  await user.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(onClose).toHaveBeenCalledOnce();
  expect(onConfirm).not.toHaveBeenCalled();
});

it("keeps referenced-category guidance visible", async () => {
  const user = userEvent.setup();
  const message = "Esta categoría tiene productos asociados. Desactivala para conservar el catálogo y el historial.";
  const onConfirm = vi.fn().mockRejectedValue(
    new ProductCategoryApiError(409, "PRODUCT_CATEGORY_HAS_PRODUCTS", message),
  );

  render(
    <ProductCategoryDeleteDialog
      category={category}
      onConfirm={onConfirm}
      onClose={vi.fn()}
    />,
  );

  await user.click(screen.getByRole("button", { name: "Eliminar categoría" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(message);
});
