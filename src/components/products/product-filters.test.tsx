import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { ProductFilters } from "@/components/products/product-filters";

it("uses a compact two-column layout before the full desktop row", () => {
  render(
    <ProductFilters
      value={{
        query: "",
        category: "all",
        stockStatus: "all",
        activeState: "all",
      }}
      onChange={vi.fn()}
      onClear={vi.fn()}
      canClear={false}
      canManage
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
