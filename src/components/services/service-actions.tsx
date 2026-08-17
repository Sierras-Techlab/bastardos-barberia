"use client";

import { MoreHorizontal, Pencil, Power, Trash2 } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ServiceCatalogItem } from "@/types/service-catalog";

type Props = {
  service: ServiceCatalogItem;
  onEdit: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
};

export const ServiceActions = ({ service, onEdit, onToggleStatus, onDelete }: Props) => (
  <DropdownMenu>
    <DropdownMenuTrigger
      type="button"
      aria-label={`Gestionar ${service.name}`}
      className={buttonVariants({ variant: "ghost", size: "icon", className: "rounded-xl text-current hover:bg-current/10 hover:text-current" })}
    >
      <MoreHorizontal />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-44 rounded-xl">
      <DropdownMenuItem onClick={onEdit}>
        <Pencil /> Editar
      </DropdownMenuItem>
      <DropdownMenuItem onClick={onToggleStatus}>
        <Power /> {service.isActive ? "Desactivar" : "Activar"}
      </DropdownMenuItem>
      <DropdownMenuItem variant="destructive" onClick={onDelete}>
        <Trash2 /> Eliminar
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);
