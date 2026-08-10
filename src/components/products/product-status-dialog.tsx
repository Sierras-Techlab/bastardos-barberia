"use client";

import { Power } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { CatalogProduct } from "@/types/product";

type ProductStatusDialogProps = {
  product: CatalogProduct;
  onClose: () => void;
  onConfirm: () => void;
};

export const ProductStatusDialog = ({ product, onClose, onConfirm }: ProductStatusDialogProps) => {
  const action = product.isActive ? "Desactivar" : "Activar";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="rounded-[1.6rem] p-5 sm:max-w-md">
        <DialogHeader>
          <span className="mb-1 flex size-10 items-center justify-center rounded-2xl bg-red-50 text-primary"><Power className="size-5" /></span>
          <DialogTitle>{action} producto</DialogTitle>
          <DialogDescription>
            {product.isActive
              ? `${product.name} dejará de estar disponible para empleados, pero conservará su información.`
              : `${product.name} volverá a estar disponible para empleados.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="-mx-5 -mb-5 mt-5 p-5">
          <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">Cancelar</Button>
          <Button type="button" onClick={onConfirm} className="rounded-xl">{action} producto</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
