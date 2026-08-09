import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";

import { ProductsView } from "@/components/products/products-view";
import productsMock from "@/data/products.mock.json";
import { authorizeProductCatalogData } from "@/lib/products/product-catalog";

const data = authorizeProductCatalogData(productsMock);

it("shows the catalog summary in desktop and mobile representations", () => {
  render(<ProductsView data={data} canManage />);

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
  render(<ProductsView data={data} canManage />);

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
  render(<ProductsView data={data} canManage />);

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

it("sorts desktop stock through ascending, descending and original order", async () => {
  const user = userEvent.setup();
  render(<ProductsView data={data} canManage />);
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
  render(<ProductsView data={data} canManage />);

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
  const { rerender } = render(<ProductsView data={data} canManage />);

  expect(screen.getAllByText("Perfume").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Inactivo").length).toBeGreaterThan(0);
  expect(screen.getByLabelText("Estado del producto")).toBeVisible();

  rerender(<ProductsView data={data} canManage={false} />);

  expect(screen.queryByText("Perfume")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Estado del producto")).not.toBeInTheDocument();
});
