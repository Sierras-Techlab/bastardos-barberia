"use client";

import { PackageSearch, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";

import { ProductFilters } from "@/components/products/product-filters";
import { ProductMetrics } from "@/components/products/product-metrics";
import { ProductMobileList } from "@/components/products/product-mobile-list";
import { ProductTable } from "@/components/products/product-table";
import { Button } from "@/components/ui/button";
import {
  calculateProductMetrics,
  filterProducts,
} from "@/lib/products/product-catalog";
import type {
  ProductCatalogData,
  ProductCatalogFilters,
} from "@/types/product";

type ProductsViewProps = {
  data: ProductCatalogData;
};

const initialFilters: ProductCatalogFilters = {
  query: "",
  category: "all",
  availability: "all",
};

export const ProductsView = ({ data }: ProductsViewProps) => {
  const [filters, setFilters] = useState(initialFilters);
  const products = useMemo(
    () => filterProducts(data.products, filters),
    [data.products, filters],
  );
  const metrics = useMemo(
    () => calculateProductMetrics(data.products),
    [data.products],
  );
  const canClear =
    filters.query !== "" ||
    filters.category !== "all" ||
    filters.availability !== "all";

  const clearFilters = () => setFilters(initialFilters);

  return (
    <div className="space-y-5">
      <ProductMetrics metrics={metrics} />
      <ProductFilters
        value={filters}
        onChange={setFilters}
        onClear={clearFilters}
        canClear={canClear}
      />

      <section aria-labelledby="products-list-title">
        <div className="mb-3 flex items-end justify-between gap-4 px-1">
          <div>
            <h2 id="products-list-title" className="text-lg font-semibold">
              Catálogo actual
            </h2>
            <p className="text-sm text-muted-foreground">
              {products.length} {products.length === 1 ? "producto" : "productos"}
            </p>
          </div>
          <p className="hidden text-xs text-muted-foreground sm:block">
            Precios de venta al público
          </p>
        </div>

        {products.length > 0 ? (
          <>
            <div className="hidden md:block">
              <ProductTable products={products} />
            </div>
            <div className="md:hidden">
              <ProductMobileList products={products} />
            </div>
          </>
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-[1.6rem] bg-white px-6 text-center shadow-sm">
            <span className="flex size-12 items-center justify-center rounded-full bg-[#f6f5f2] text-primary">
              <PackageSearch className="size-5" />
            </span>
            <h3 className="mt-4 font-semibold">No encontramos productos</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Probá con otro nombre o quitá los filtros aplicados.
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-4 rounded-xl"
              onClick={clearFilters}
            >
              <RotateCcw />
              Limpiar filtros
            </Button>
          </div>
        )}
      </section>
    </div>
  );
};
