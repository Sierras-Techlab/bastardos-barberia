"use client";

import { PackagePlus, PackageSearch, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ProductFilters } from "@/components/products/product-filters";
import { ProductEditorDialog } from "@/components/products/product-editor-dialog";
import { ProductCategoriesDialog } from "@/components/products/product-categories-dialog";
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
import {
  productCategoryClient as defaultProductCategoryClient,
  type ProductCategoryClient,
} from "@/lib/product-categories/client";
import { sortProducts } from "@/lib/products/product-management";
import type {
  ProductCatalogData,
  ProductCatalogFilters,
  CatalogProduct,
  ProductEditorInput,
  ProductSort,
} from "@/types/product";
import type { ProductCategory } from "@/types/product-category";

type ProductsViewProps = {
  data: ProductCatalogData;
  categories: ProductCategory[];
  canManage: boolean;
  productClient?: ProductClient;
  categoryClient?: Pick<
    ProductCategoryClient,
    "create" | "update" | "deactivate" | "remove"
  >;
};

const initialFilters: ProductCatalogFilters = {
  query: "",
  categoryId: "all",
  stockStatus: "all",
  activeState: "all",
};

export const ProductsView = ({
  data,
  categories: initialCategories,
  canManage,
  productClient = defaultProductClient,
  categoryClient = defaultProductCategoryClient,
}: ProductsViewProps) => {
  const [catalogProducts, setCatalogProducts] = useState(() => data.products);
  const [categories, setCategories] = useState(initialCategories);
  const [filters, setFilters] = useState(initialFilters);
  const [sort, setSort] = useState<ProductSort>("original");
  const [editor, setEditor] = useState<{
    mode: "create" | "edit";
    product: CatalogProduct | null;
  } | null>(null);
  const [stockProduct, setStockProduct] = useState<CatalogProduct | null>(null);
  const [statusProduct, setStatusProduct] = useState<CatalogProduct | null>(null);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
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
    filters.categoryId !== "all" ||
    filters.stockStatus !== "all" ||
    filters.activeState !== "all";

  const clearFilters = () => setFilters(initialFilters);
  const replaceCategories = (next: ProductCategory[]) => {
    setCategories(next);
    setCatalogProducts((current) =>
      current.map((product) => {
        const category = next.find((item) => item.id === product.category.id);
        return category ? { ...product, category } : product;
      }),
    );
  };
  const replaceProduct = (updated: CatalogProduct) =>
    setCatalogProducts((current) =>
      current.map((product) =>
        product.id === updated.id ? updated : product,
      ),
    );
  const saveProduct = async (input: ProductEditorInput) => {
    if (editor?.mode === "edit" && editor.product) {
      const changes = {
        name: input.name,
        categoryId: input.categoryId,
        price: input.price,
      };
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
        categories={categories}
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
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => setIsCategoryDialogOpen(true)}
              >
                Administrar categorías
              </Button>
              <Button
                type="button"
                className="rounded-xl"
                onClick={() => setEditor({ mode: "create", product: null })}
              >
                <PackagePlus /> Nuevo producto
              </Button>
            </div>
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
          categories={categories}
          onClose={() => setEditor(null)}
          onSave={saveProduct}
        />
      )}
      {isCategoryDialogOpen && (
        <ProductCategoriesDialog
          categories={categories}
          categoryClient={categoryClient}
          onCategoriesChange={replaceCategories}
          onClose={() => setIsCategoryDialogOpen(false)}
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
