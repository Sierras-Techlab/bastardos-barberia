"use client";

import { Boxes, MoreHorizontal, Pencil, Power } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CatalogProduct } from "@/types/product";

type ProductActionsProps = {
  product: CatalogProduct;
  onEdit: () => void;
  onAdjustStock: () => void;
  onToggleStatus: () => void;
};

export const ProductActions = ({
  product,
  onEdit,
  onAdjustStock,
  onToggleStatus,
}: ProductActionsProps) => (
  <DropdownMenu>
    <DropdownMenuTrigger
      type="button"
      aria-label={`Gestionar ${product.name}`}
      className={buttonVariants({
        variant: "ghost",
        size: "icon",
        className: "rounded-xl",
      })}
    >
      <MoreHorizontal />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="min-w-48 rounded-xl">
      <DropdownMenuItem onClick={onEdit}>
        <Pencil /> Editar
      </DropdownMenuItem>
      <DropdownMenuItem onClick={onAdjustStock}>
        <Boxes /> Ajustar stock
      </DropdownMenuItem>
      <DropdownMenuItem onClick={onToggleStatus}>
        <Power /> {product.isActive ? "Desactivar" : "Activar"}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);
