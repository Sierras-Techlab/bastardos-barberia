import { RotateCcw, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  ProductCatalogFilters as ProductFiltersValue,
  ProductAvailability,
  ProductCategory,
} from "@/types/product";

type ProductFiltersProps = {
  value: ProductFiltersValue;
  onChange: (value: ProductFiltersValue) => void;
  onClear: () => void;
  canClear: boolean;
};

const selectClassName =
  "h-11 min-w-0 rounded-xl border border-black/10 bg-[#f6f5f2] px-3 text-sm outline-none transition-colors focus:border-ring focus:bg-white focus:ring-2 focus:ring-ring/30";

export const ProductFilters = ({
  value,
  onChange,
  onClear,
  canClear,
}: ProductFiltersProps) => (
  <section
    aria-label="Filtros de productos"
    className="rounded-[1.4rem] bg-white p-3 shadow-sm sm:p-4"
  >
    <div className="grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_13rem_13rem_auto]">
      <div className="relative min-w-0">
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

      <select
        aria-label="Disponibilidad"
        value={value.availability}
        onChange={(event) =>
          onChange({
            ...value,
            availability: event.target.value as ProductAvailability | "all",
          })
        }
        className={selectClassName}
      >
        <option value="all">Toda disponibilidad</option>
        <option value="available">Disponibles</option>
        <option value="unavailable">No disponibles</option>
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
