import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";

import { ProductsView } from "@/components/products/products-view";
import productsMock from "@/data/products.mock.json";
import { authorizeProductCatalogData } from "@/lib/products/product-catalog";

const data = authorizeProductCatalogData(productsMock);

it("shows the catalog summary in desktop and mobile representations", () => {
  render(<ProductsView data={data} />);

  expect(
    screen.getByRole("region", { name: /resumen de productos/i }),
  ).toBeVisible();
  expect(
    screen.getByRole("table", { name: /catálogo de productos/i }),
  ).toBeVisible();
  expect(
    screen.getByRole("list", { name: /catálogo móvil de productos/i }),
  ).toBeVisible();
  expect(screen.getAllByText("Hunter Cream")).toHaveLength(2);
  expect(screen.getAllByText(/30\.000/)).toHaveLength(2);
  expect(screen.getAllByText("Disponible").length).toBeGreaterThan(0);
  expect(screen.getAllByText("8 unidades")).toHaveLength(2);
  expect(screen.getAllByText("Stock bajo").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Sin stock").length).toBeGreaterThan(0);
});

it("filters by product name and restores the complete catalog", async () => {
  const user = userEvent.setup();
  render(<ProductsView data={data} />);

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
  render(<ProductsView data={data} />);

  await user.selectOptions(screen.getByLabelText("Categoría"), "fragrance");
  await user.selectOptions(screen.getByLabelText("Estado de stock"), "available");

  expect(screen.getByText(/no encontramos productos/i)).toBeVisible();

  await user.click(
    screen.getByRole("button", { name: /limpiar filtros/i }),
  );

  expect(screen.getAllByText("Hunter Cream")).toHaveLength(2);
  expect(screen.getByLabelText("Categoría")).toHaveValue("all");
  expect(screen.getByLabelText("Estado de stock")).toHaveValue("all");
});
