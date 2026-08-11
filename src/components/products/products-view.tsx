"use client";

import { PackagePlus, PackageSearch, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ProductFilters } from "@/components/products/product-filters";
import { ProductEditorDialog } from "@/components/products/product-editor-dialog";
import { ProductStatusDialog } from "@/components/products/product-status-dialog";
import { ProductStockDialog } from "@/components/products/product-stock-dialog";
import { ProductMetrics } from "@/components/products/product-metrics";
import { ProductMobileList } from "@/components/products/product-mobile-list";
import { ProductTable } from "@/components/products/product-table";
import { Button } from "@/components/ui/button";
import {
  calculateProductMetrics,
  filterProducts,
} from "@/lib/products/product-catalog";
import {
  productClient as defaultProductClient,
  type ProductClient,
} from "@/lib/products/client";
import { sortProducts } from "@/lib/products/product-management";
import type {
  ProductCatalogData,
  ProductCatalogFilters,
  CatalogProduct,
  ProductEditorInput,
  ProductSort,
} from "@/types/product";

type ProductsViewProps = {
  data: ProductCatalogData;
  canManage: boolean;
  productClient?: ProductClient;
};

const initialFilters: ProductCatalogFilters = {
  query: "",
  category: "all",
  stockStatus: "all",
  activeState: "all",
};

export const ProductsView = ({
  data,
  canManage,
  productClient = defaultProductClient,
}: ProductsViewProps) => {
  const [catalogProducts, setCatalogProducts] = useState(() => data.products);
  const [filters, setFilters] = useState(initialFilters);
  const [sort, setSort] = useState<ProductSort>("original");
  const [editor, setEditor] = useState<{
    mode: "create" | "edit";
    product: CatalogProduct | null;
  } | null>(null);
  const [stockProduct, setStockProduct] = useState<CatalogProduct | null>(null);
  const [statusProduct, setStatusProduct] = useState<CatalogProduct | null>(null);
  const visibleProducts = useMemo(
    () =>
      canManage
        ? catalogProducts
        : catalogProducts.filter((product) => product.isActive),
    [canManage, catalogProducts],
  );
  const products = useMemo(
    () => sortProducts(filterProducts(visibleProducts, filters), sort),
    [filters, sort, visibleProducts],
  );
  const metrics = useMemo(
    () => calculateProductMetrics(visibleProducts),
    [visibleProducts],
  );
  const canClear =
    filters.query !== "" ||
    filters.category !== "all" ||
    filters.stockStatus !== "all" ||
    filters.activeState !== "all";

  const clearFilters = () => setFilters(initialFilters);
  const replaceProduct = (updated: CatalogProduct) =>
    setCatalogProducts((current) =>
      current.map((product) =>
        product.id === updated.id ? updated : product,
      ),
    );
  const saveProduct = async (input: ProductEditorInput) => {
    if (editor?.mode === "edit" && editor.product) {
      const { stock: _stock, ...changes } = input;
      const updated = await productClient.update(editor.product.id, changes);
      replaceProduct(updated);
      toast.success("Producto actualizado correctamente.");
    } else {
      const created = await productClient.create(input);
      setCatalogProducts((current) => [...current, created]);
      toast.success("Producto añadido correctamente.");
    }
    setEditor(null);
  };

  return (
    <div className="space-y-5">
      <ProductMetrics metrics={metrics} />
      <ProductFilters
        value={filters}
        onChange={setFilters}
        onClear={clearFilters}
        canClear={canClear}
        canManage={canManage}
        sort={sort}
        onSortChange={setSort}
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
          {canManage ? (
            <Button
              type="button"
              className="rounded-xl"
              onClick={() => setEditor({ mode: "create", product: null })}
            >
              <PackagePlus /> Nuevo producto
            </Button>
          ) : (
            <p className="hidden text-xs text-muted-foreground sm:block">
              Precios de venta al público
            </p>
          )}
        </div>

        {products.length > 0 ? (
          <>
            <div className="hidden md:block">
              <ProductTable
                products={products}
                sort={sort}
                onSortChange={setSort}
                canManage={canManage}
                onEdit={(product) => setEditor({ mode: "edit", product })}
                onAdjustStock={setStockProduct}
                onToggleStatus={setStatusProduct}
              />
            </div>
            <div className="md:hidden">
              <ProductMobileList
                products={products}
                canManage={canManage}
                onEdit={(product) => setEditor({ mode: "edit", product })}
                onAdjustStock={setStockProduct}
                onToggleStatus={setStatusProduct}
              />
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
      {editor && (
        <ProductEditorDialog
          key={`${editor.mode}-${editor.product?.id ?? "new"}`}
          mode={editor.mode}
          product={editor.product}
          products={catalogProducts}
          onClose={() => setEditor(null)}
          onSave={saveProduct}
        />
      )}
      {stockProduct && (
        <ProductStockDialog
          product={stockProduct}
          onClose={() => setStockProduct(null)}
          onSave={async (adjustment) => {
            const updated = await productClient.adjustStock(
              stockProduct.id,
              adjustment,
            );
            replaceProduct(updated);
            setStockProduct(null);
            toast.success("Stock actualizado correctamente.");
          }}
        />
      )}
      {statusProduct && (
        <ProductStatusDialog
          product={statusProduct}
          onClose={() => setStatusProduct(null)}
          onConfirm={async () => {
            const updated = await productClient.update(statusProduct.id, {
              isActive: !statusProduct.isActive,
            });
            replaceProduct(updated);
            toast.success(
              statusProduct.isActive
                ? "Producto desactivado correctamente."
                : "Producto activado correctamente.",
            );
            setStatusProduct(null);
          }}
        />
      )}
    </div>
  );
};
