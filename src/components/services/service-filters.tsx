import { RotateCcw, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ServiceCatalogFilters, ServiceCatalogSort } from "@/types/service-catalog";

type Props = { filters: ServiceCatalogFilters; sort: ServiceCatalogSort; onFiltersChange: (value: ServiceCatalogFilters) => void; onSortChange: (value: ServiceCatalogSort) => void; onClear: () => void; canClear: boolean; canManage: boolean };

export const ServiceFilters = ({ filters, sort, onFiltersChange, onSortChange, onClear, canClear, canManage }: Props) => (
  <section aria-label="Filtros de servicios" className="rounded-[1.4rem] bg-white p-3 shadow-sm sm:p-4">
    <div className={`grid gap-3 ${canManage ? "sm:grid-cols-2 lg:grid-cols-[minmax(15rem,1fr)_12rem_12rem_auto]" : "sm:grid-cols-[minmax(15rem,1fr)_12rem_auto]"}`}>
      <div className="relative min-w-0"><Search className="pointer-events-none absolute top-3.5 left-3.5 size-4 text-muted-foreground" /><Input type="search" aria-label="Buscar servicios" placeholder="Buscar por nombre" value={filters.query} onChange={(event) => onFiltersChange({ ...filters, query: event.target.value })} className="h-11 rounded-xl bg-[#f6f5f2] pl-10 shadow-none" /></div>
      {canManage && <select aria-label="Filtrar por estado" value={filters.activeState} onChange={(event) => onFiltersChange({ ...filters, activeState: event.target.value as ServiceCatalogFilters["activeState"] })} className="h-11 rounded-xl border border-black/10 bg-[#f6f5f2] px-3 text-sm"><option value="all">Todos</option><option value="active">Activos</option><option value="inactive">Inactivos</option></select>}
      <select aria-label="Ordenar servicios" value={sort} onChange={(event) => onSortChange(event.target.value as ServiceCatalogSort)} className="h-11 rounded-xl border border-black/10 bg-[#f6f5f2] px-3 text-sm"><option value="original">Orden original</option><option value="name-asc">Nombre A–Z</option><option value="price-asc">Menor precio</option><option value="price-desc">Mayor precio</option></select>
      <Button type="button" variant="ghost" disabled={!canClear} onClick={onClear} className="h-11 rounded-xl"><RotateCcw /> Limpiar filtros</Button>
    </div>
  </section>
);
