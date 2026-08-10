import { RotateCcw, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  ProductCatalogFilters as ProductFiltersValue,
  ProductCategory,
  ProductSort,
  ProductStockStatus,
} from "@/types/product";

type ProductFiltersProps = {
  value: ProductFiltersValue;
  onChange: (value: ProductFiltersValue) => void;
  onClear: () => void;
  canClear: boolean;
  canManage: boolean;
  sort: ProductSort;
  onSortChange: (sort: ProductSort) => void;
};

const selectClassName =
  "h-11 min-w-0 rounded-xl border border-black/10 bg-[#f6f5f2] px-3 text-sm outline-none transition-colors focus:border-ring focus:bg-white focus:ring-2 focus:ring-ring/30";

export const ProductFilters = ({
  value,
  onChange,
  onClear,
  canClear,
  canManage,
  sort,
  onSortChange,
}: ProductFiltersProps) => (
  <section
    aria-label="Filtros de productos"
    className="rounded-[1.4rem] bg-white p-3 shadow-sm sm:p-4"
  >
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[minmax(15rem,1fr)_12rem_12rem_12rem_auto]">
      <div className="relative min-w-0 sm:col-span-2 lg:col-span-1 xl:col-span-1">
        <Search className="pointer-events-none absolute top-3.5 left-3.5 size-4 text-muted-foreground" />
        <Input
          type="search"
          aria-label="Buscar productos"
          placeholder="Buscar por nombre"
          value={value.query}
          onChange={(event) => onChange({ ...value, query: event.target.value })}
          className="h-11 rounded-xl border-black/10 bg-[#f6f5f2] pl-10 shadow-none"
        />
      </div>

      <select
        aria-label="Categoría"
        value={value.category}
        onChange={(event) =>
          onChange({
            ...value,
            category: event.target.value as ProductCategory | "all",
          })
        }
        className={selectClassName}
      >
        <option value="all">Todas las categorías</option>
        <option value="hair-care">Cuidado capilar</option>
        <option value="styling">Peinado y fijación</option>
        <option value="beard-care">Cuidado de barba</option>
        <option value="fragrance">Fragancias</option>
      </select>

      {canManage && (
        <select
          aria-label="Estado del producto"
          value={value.activeState}
          onChange={(event) =>
            onChange({
              ...value,
              activeState: event.target.value as ProductFiltersValue["activeState"],
            })
          }
          className={selectClassName}
        >
          <option value="all">Activos e inactivos</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </select>
      )}

      <select
        aria-label="Ordenar por"
        value={sort}
        onChange={(event) => onSortChange(event.target.value as ProductSort)}
        className={`${selectClassName} lg:hidden`}
      >
        <option value="original">Orden original</option>
        <option value="stock-asc">Menor stock</option>
        <option value="stock-desc">Mayor stock</option>
        <option value="price-asc">Menor precio</option>
        <option value="price-desc">Mayor precio</option>
      </select>

      <select
        aria-label="Estado de stock"
        value={value.stockStatus}
        onChange={(event) =>
          onChange({
            ...value,
            stockStatus: event.target.value as ProductStockStatus | "all",
          })
        }
        className={selectClassName}
      >
        <option value="all">Todo el stock</option>
        <option value="available">Disponible</option>
        <option value="low-stock">Stock bajo</option>
        <option value="out-of-stock">Sin stock</option>
      </select>

      <Button
        type="button"
        variant="ghost"
        className="h-11 rounded-xl"
        disabled={!canClear}
        onClick={onClear}
      >
        <RotateCcw />
        Limpiar
      </Button>
    </div>
  </section>
);
