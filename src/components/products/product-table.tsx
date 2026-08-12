import { ProductActions } from "@/components/products/product-actions";
import { Badge } from "@/components/ui/badge";
import { formatArs } from "@/lib/incomes/income-calculations";
import {
  formatProductCategory,
  getProductAvailabilityStatus,
} from "@/lib/products/product-catalog";
import type { CatalogProduct, ProductSort } from "@/types/product";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

type ProductTableProps = {
  products: CatalogProduct[];
  sort: ProductSort;
  onSortChange: (sort: ProductSort) => void;
  canManage?: boolean;
  onEdit?: (product: CatalogProduct) => void;
  onAdjustStock?: (product: CatalogProduct) => void;
  onToggleStatus?: (product: CatalogProduct) => void;
};

const nextSort = (
  current: ProductSort,
  field: "stock" | "price",
): ProductSort => {
  if (current === `${field}-asc`) return `${field}-desc`;
  if (current === `${field}-desc`) return "original";
  return `${field}-asc`;
};

const SortIcon = ({ sort, field }: { sort: ProductSort; field: "stock" | "price" }) => {
  if (sort === `${field}-asc`) return <ArrowUp className="size-3.5" />;
  if (sort === `${field}-desc`) return <ArrowDown className="size-3.5" />;
  return <ArrowUpDown className="size-3.5 opacity-50" />;
};

export const ProductTable = ({
  products,
  sort,
  onSortChange,
  canManage = false,
  onEdit,
  onAdjustStock,
  onToggleStatus,
}: ProductTableProps) => (
  <div className="overflow-hidden rounded-[1.6rem] bg-white shadow-sm">
    <div className="overflow-x-auto">
      <table aria-label="Catálogo de productos" className="w-full text-sm">
        <thead className="border-b border-black/5 bg-[#f8f7f4] text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-5 py-3.5 font-medium">Producto</th>
            <th className="px-5 py-3.5 font-medium">Categoría</th>
            <th
              className="px-5 py-3.5 font-medium"
              aria-sort={sort === "stock-asc" ? "ascending" : sort === "stock-desc" ? "descending" : "none"}
            >
              <button
                type="button"
                aria-label="Ordenar por stock"
                className="inline-flex items-center gap-1.5 hover:text-foreground"
                onClick={() => onSortChange(nextSort(sort, "stock"))}
              >
                Stock <SortIcon sort={sort} field="stock" />
              </button>
            </th>
            <th
              className="px-5 py-3.5 text-right font-medium"
              aria-sort={sort === "price-asc" ? "ascending" : sort === "price-desc" ? "descending" : "none"}
            >
              <button
                type="button"
                aria-label="Ordenar por precio"
                className="ml-auto inline-flex items-center gap-1.5 hover:text-foreground"
                onClick={() => onSortChange(nextSort(sort, "price"))}
              >
                Precio <SortIcon sort={sort} field="price" />
              </button>
            </th>
            {canManage && (
              <th className="w-14 px-3 py-3.5">
                <span className="sr-only">Acciones</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {products.map((product) => {
            const availabilityStatus = getProductAvailabilityStatus(product);

            return (
            <tr
              key={product.id}
              className="border-b border-black/5 transition-colors last:border-0 hover:bg-[#f6f5f2]"
            >
              <td className="px-5 py-4 font-medium">
                <div className="flex items-center gap-2">
                  {product.name}
                  {!product.isActive && (
                    <Badge className="rounded-full bg-black/5 text-muted-foreground hover:bg-black/5">
                      Inactivo
                    </Badge>
                  )}
                </div>
              </td>
              <td className="px-5 py-4 text-muted-foreground">
                {formatProductCategory(product.category)}
              </td>
              <td className="px-5 py-4">
                <div className="flex items-center gap-2">
                  <span className="min-w-20 font-medium">
                    {product.stock} {product.stock === 1 ? "unidad" : "unidades"}
                  </span>
                  <Badge
                    className={
                      availabilityStatus === "unavailable"
                        ? "rounded-full bg-black/5 text-muted-foreground hover:bg-black/5"
                        : availabilityStatus === "available"
                        ? "rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
                        : availabilityStatus === "low-stock"
                          ? "rounded-full bg-amber-50 text-amber-700 hover:bg-amber-50"
                          : "rounded-full bg-red-50 text-red-700 hover:bg-red-50"
                    }
                  >
                    {availabilityStatus === "unavailable"
                      ? "No disponible"
                      : availabilityStatus === "available"
                      ? "Disponible"
                      : availabilityStatus === "low-stock"
                        ? "Stock bajo"
                        : "Sin stock"}
                  </Badge>
                </div>
              </td>
              <td className="px-5 py-4 text-right text-base font-semibold">
                {formatArs(product.price)}
              </td>
              {canManage && (
                <td className="px-3 py-4 text-right">
                  <ProductActions
                    product={product}
                    onEdit={() => onEdit?.(product)}
                    onAdjustStock={() => onAdjustStock?.(product)}
                    onToggleStatus={() => onToggleStatus?.(product)}
                  />
                </td>
              )}
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
);
