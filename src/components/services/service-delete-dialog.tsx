"use client";

import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ServiceCatalogItem } from "@/types/service-catalog";

type Props = {
  service: ServiceCatalogItem;
  onClose: () => void;
  onConfirm: () => void;
};

export const ServiceDeleteDialog = ({ service, onClose, onConfirm }: Props) => (
  <Dialog open onOpenChange={(open) => !open && onClose()}>
    <DialogContent className="rounded-[1.6rem] p-5 sm:max-w-md">
      <DialogHeader>
        <span className="mb-1 flex size-10 items-center justify-center rounded-2xl bg-red-50 text-destructive">
          <Trash2 className="size-5" />
        </span>
        <DialogTitle>Eliminar servicio</DialogTitle>
        <DialogDescription>
          ¿Querés eliminar el servicio “{service.name}”? Dejará de estar
          disponible para nuevas ventas, pero las ventas ya registradas
          conservarán su información.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter className="-mx-5 -mb-5 mt-5 p-5">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="rounded-xl"
        >
          Cancelar
        </Button>
        <Button
          type="button"
          variant="destructive"
          onClick={onConfirm}
          className="rounded-xl"
        >
          Eliminar servicio
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
