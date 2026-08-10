"use client";

import { Plus, RotateCcw, Scissors } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ServiceCardGrid } from "@/components/services/service-card-grid";
import { ServiceDeleteDialog } from "@/components/services/service-delete-dialog";
import { ServiceEditorDialog } from "@/components/services/service-editor-dialog";
import { ServiceFilters } from "@/components/services/service-filters";
import { ServiceMetrics } from "@/components/services/service-metrics";
import { ServiceStatusDialog } from "@/components/services/service-status-dialog";
import { Button } from "@/components/ui/button";
import { calculateServiceMetrics, filterServices, sortServices } from "@/lib/services/service-catalog";
import type { ServiceCatalogData, ServiceCatalogFilters, ServiceCatalogItem, ServiceCatalogSort, ServiceEditorInput } from "@/types/service-catalog";

const initialFilters: ServiceCatalogFilters = { query: "", activeState: "all" };

export const ServicesView = ({ data, canManage }: { data: ServiceCatalogData; canManage: boolean }) => {
  const [catalog, setCatalog] = useState(() => data.services);
  const [filters, setFilters] = useState(initialFilters);
  const [sort, setSort] = useState<ServiceCatalogSort>("original");
  const [editor, setEditor] = useState<{ mode: "create" | "edit"; service: ServiceCatalogItem | null } | null>(null);
  const [statusService, setStatusService] = useState<ServiceCatalogItem | null>(null);
  const [deleteService, setDeleteService] = useState<ServiceCatalogItem | null>(null);
  const visibleServices = useMemo(() => canManage ? catalog : catalog.filter(({ isActive }) => isActive), [canManage, catalog]);
  const services = useMemo(() => sortServices(filterServices(visibleServices, filters), sort), [filters, sort, visibleServices]);
  const metrics = useMemo(() => calculateServiceMetrics(visibleServices), [visibleServices]);
  const canClear = filters.query !== "" || filters.activeState !== "all" || sort !== "original";

  const clear = () => { setFilters(initialFilters); setSort("original"); };
  const saveService = (input: ServiceEditorInput) => {
    if (editor?.mode === "edit" && editor.service) {
      setCatalog((current) => current.map((service) => service.id === editor.service?.id ? { ...service, ...input } : service));
      toast.success("Servicio actualizado correctamente.");
    } else {
      setCatalog((current) => [...current, { ...input, id: `mock-service-${current.length + 1}`, isActive: true }]);
      toast.success("Servicio añadido correctamente.");
    }
    setEditor(null);
  };

  return (
    <div className="space-y-5">
      <ServiceMetrics metrics={metrics} />
      <ServiceFilters filters={filters} sort={sort} onFiltersChange={setFilters} onSortChange={setSort} onClear={clear} canClear={canClear} canManage={canManage} />
      <section aria-labelledby="services-title">
        <div className="mb-3 flex items-end justify-between gap-3 px-1"><div><h2 id="services-title" className="text-lg font-semibold">Servicios disponibles</h2><p className="text-sm text-muted-foreground">{services.length} {services.length === 1 ? "servicio" : "servicios"}</p></div>{canManage && <Button type="button" className="rounded-xl" onClick={() => setEditor({ mode: "create", service: null })}><Plus /> Nuevo servicio</Button>}</div>
        {services.length ? <ServiceCardGrid services={services} canManage={canManage} onEdit={(service) => setEditor({ mode: "edit", service })} onToggleStatus={setStatusService} onDelete={setDeleteService} /> : <div className="flex min-h-64 flex-col items-center justify-center rounded-[1.6rem] bg-white px-6 text-center shadow-sm"><Scissors className="size-8 text-primary" /><h3 className="mt-4 font-semibold">No encontramos servicios</h3><p className="mt-1 text-sm text-muted-foreground">Probá con otra búsqueda o quitá los filtros.</p><Button type="button" variant="outline" className="mt-4 rounded-xl" onClick={clear}><RotateCcw /> Limpiar filtros</Button></div>}
      </section>
      {editor && <ServiceEditorDialog key={`${editor.mode}-${editor.service?.id ?? "new"}`} mode={editor.mode} service={editor.service} services={catalog} onClose={() => setEditor(null)} onSave={saveService} />}
      {statusService && <ServiceStatusDialog service={statusService} onClose={() => setStatusService(null)} onConfirm={() => { setCatalog((current) => current.map((service) => service.id === statusService.id ? { ...service, isActive: !service.isActive } : service)); toast.success(statusService.isActive ? "Servicio desactivado correctamente." : "Servicio activado correctamente."); setStatusService(null); }} />}
      {deleteService && <ServiceDeleteDialog service={deleteService} onClose={() => setDeleteService(null)} onConfirm={() => { setCatalog((current) => current.filter((service) => service.id !== deleteService.id)); toast.success("Servicio eliminado correctamente."); setDeleteService(null); }} />}
    </div>
  );
};
