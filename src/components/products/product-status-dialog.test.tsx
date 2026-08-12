import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { ProductStatusDialog } from "@/components/products/product-status-dialog";
import productsMock from "@/data/products.mock.json";
import { authorizeProductCatalogData } from "@/lib/products/product-catalog";

const product = authorizeProductCatalogData(productsMock).products[0];

it("asks for confirmation before deactivating a product", async () => {
  const user = userEvent.setup();
  const onConfirm = vi.fn();
  render(
    <ProductStatusDialog
      product={product}
      onClose={vi.fn()}
      onConfirm={onConfirm}
    />,
  );

  expect(screen.getByText(/dejará de estar disponible para empleados/i)).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Desactivar producto" }));
  expect(onConfirm).toHaveBeenCalledOnce();
});

it("prevents duplicate status confirmations while pending", async () => {
  const user = userEvent.setup();
  let resolveSave: () => void = () => undefined;
  const onConfirm = vi.fn(
    () => new Promise<void>((resolve) => { resolveSave = resolve; }),
  );
  render(
    <ProductStatusDialog
      product={product}
      onClose={vi.fn()}
      onConfirm={onConfirm}
    />,
  );

  const button = screen.getByRole("button", { name: "Desactivar producto" });
  await user.click(button);
  await user.click(button);

  expect(onConfirm).toHaveBeenCalledOnce();
  expect(button).toBeDisabled();
  resolveSave();
});
