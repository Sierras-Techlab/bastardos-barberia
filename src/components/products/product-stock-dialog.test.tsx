import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { ProductStockDialog } from "@/components/products/product-stock-dialog";
import productsMock from "@/data/products.mock.json";
import { authorizeProductCatalogData } from "@/lib/products/product-catalog";

const product = authorizeProductCatalogData(productsMock).products[0];

it("submits an entry adjustment and previews the resulting stock", async () => {
  const user = userEvent.setup();
  const onSave = vi.fn();
  render(<ProductStockDialog product={product} onClose={vi.fn()} onSave={onSave} />);

  await user.type(screen.getByLabelText("Cantidad"), "4");
  expect(screen.getByText("Stock resultante: 12 unidades")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Guardar ajuste" }));

  expect(onSave).toHaveBeenCalledWith({ kind: "entry", quantity: 4 });
});

it("prevents an exit greater than the available stock", async () => {
  const user = userEvent.setup();
  render(<ProductStockDialog product={product} onClose={vi.fn()} onSave={vi.fn()} />);

  await user.click(screen.getByLabelText("Salida"));
  await user.type(screen.getByLabelText("Cantidad"), "9");
  await user.click(screen.getByRole("button", { name: "Guardar ajuste" }));

  expect(
    screen.getByText("No podés descontar más unidades que el stock disponible."),
  ).toBeVisible();
});
