import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { ProductFilters } from "@/components/products/product-filters";

it("uses a compact two-column layout before the full desktop row", () => {
  render(
    <ProductFilters
      value={{
        query: "",
        categoryId: "all",
        stockStatus: "all",
        activeState: "all",
      }}
      onChange={vi.fn()}
      onClear={vi.fn()}
      canClear={false}
      canManage
      categories={[
        { id: "20000000-0000-4000-8000-000000000001", name: "Cuidado capilar", isActive: true },
        { id: "20000000-0000-4000-8000-000000000002", name: "Peinado y styling", isActive: true },
      ]}
      sort="original"
      onSortChange={vi.fn()}
    />,
  );

  const filters = screen.getByRole("region", { name: "Filtros de productos" });
  const grid = filters.firstElementChild;

  expect(grid).toHaveClass("sm:grid-cols-2");
  expect(screen.getByRole("searchbox", { name: "Buscar productos" }).parentElement)
    .toHaveClass("sm:col-span-2", "xl:col-span-1");
});

it("renders category filters from the live catalog", () => {
  render(
    <ProductFilters
      value={{ query: "", categoryId: "all", stockStatus: "all", activeState: "all" }}
      onChange={vi.fn()}
      onClear={vi.fn()}
      canClear={false}
      canManage
      categories={[
        { id: "20000000-0000-4000-8000-000000000001", name: "Cuidado capilar", isActive: true },
      ]}
      sort="original"
      onSortChange={vi.fn()}
    />,
  );

  expect(screen.getByRole("option", { name: "Cuidado capilar" })).toHaveValue(
    "20000000-0000-4000-8000-000000000001",
  );
});
