import { Scissors } from "lucide-react";

import { ServiceActions } from "@/components/services/service-actions";
import { Badge } from "@/components/ui/badge";
import { formatArs } from "@/lib/incomes/income-calculations";
import type { ServiceCatalogItem } from "@/types/service-catalog";

type Props = {
  services: ServiceCatalogItem[];
  canManage: boolean;
  onEdit?: (service: ServiceCatalogItem) => void;
  onToggleStatus?: (service: ServiceCatalogItem) => void;
  onDelete?: (service: ServiceCatalogItem) => void;
};
export const ServiceCardGrid = ({
  services,
  canManage,
  onEdit,
  onToggleStatus,
  onDelete,
}: Props) => (
  <ul
    aria-label="Catálogo de servicios"
    className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
  >
    {services.map((service, index) => (
      <li
        key={service.id}
        className={`group min-h-44 rounded-[1.5rem] p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${!service.isActive ? "bg-[#d9d7d2] text-foreground" : index % 3 === 0 ? "bg-[#202023] text-white" : index % 3 === 1 ? "bg-primary text-white" : "bg-white"}`}
      >
        <div className="flex items-start justify-between gap-4">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-current/10">
            <Scissors className="size-5" />
          </span>
          <div className="flex items-center gap-1">
            <Badge
              className={`rounded-full border-0 text-white ${service.isActive ? "bg-emerald-500" : "bg-orange-500"}`}
            >
              {service.isActive ? "Activo" : "Inactivo"}
            </Badge>
            {canManage && (
              <ServiceActions
                service={service}
                onEdit={() => onEdit?.(service)}
                onToggleStatus={() => onToggleStatus?.(service)}
                onDelete={() => onDelete?.(service)}
              />
            )}
          </div>
        </div>
        <div className="mt-8">
          <p className="max-w-sm text-lg font-semibold leading-snug">
            {service.name}
          </p>
          <p className="mt-3 text-2xl font-semibold tracking-tight">
            {formatArs(service.price)}
          </p>
        </div>
      </li>
    ))}
  </ul>
);
