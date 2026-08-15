"use client";

import { Trash2 } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ProductCategory } from "@/types/product-category";

type Props = {
  category: ProductCategory;
  onConfirm: () => Promise<void>;
  onClose: () => void;
};

const messageFor = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "No se pudo eliminar la categoría.";

export const ProductCategoryDeleteDialog = ({
  category,
  onConfirm,
  onClose,
}: Props) => {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savingRef = useRef(false);

  const confirm = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);
    setError(null);

    try {
      await onConfirm();
      onClose();
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !isSaving && onClose()}>
      <DialogContent className="rounded-[1.6rem] p-5 sm:max-w-md">
        <DialogHeader>
          <span className="mb-1 flex size-10 items-center justify-center rounded-2xl bg-red-50 text-destructive">
            <Trash2 className="size-5" />
          </span>
          <DialogTitle>Eliminar categoría</DialogTitle>
          <DialogDescription>
            ¿Querés eliminar “{category.name}” permanentemente? Sólo se
            eliminará si todavía no tiene productos asociados.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        <DialogFooter className="-mx-5 -mb-5 mt-5 p-5">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-xl"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={confirm}
            disabled={isSaving}
            className="rounded-xl"
          >
            {isSaving ? "Eliminando..." : "Eliminar categoría"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
