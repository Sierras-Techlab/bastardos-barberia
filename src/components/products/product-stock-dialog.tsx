"use client";

import { Boxes } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { applyStockAdjustment } from "@/lib/products/product-management";
import type { CatalogProduct, StockAdjustment } from "@/types/product";

type ProductStockDialogProps = {
  product: CatalogProduct;
  onClose: () => void;
  onSave: (stock: number) => void;
};

export const ProductStockDialog = ({ product, onClose, onSave }: ProductStockDialogProps) => {
  const [kind, setKind] = useState<StockAdjustment["kind"]>("entry");
  const [quantity, setQuantity] = useState("");
  const [error, setError] = useState<string | null>(null);
  const numericQuantity = Number(quantity);
  const preview = Number.isInteger(numericQuantity) && numericQuantity > 0
    ? kind === "entry"
      ? product.stock + numericQuantity
      : Math.max(0, product.stock - numericQuantity)
    : product.stock;

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      onSave(applyStockAdjustment(product.stock, { kind, quantity: numericQuantity }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo ajustar el stock.");
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="rounded-[1.6rem] p-5 sm:max-w-md">
        <form onSubmit={submit}>
          <DialogHeader>
            <span className="mb-1 flex size-10 items-center justify-center rounded-2xl bg-red-50 text-primary"><Boxes className="size-5" /></span>
            <DialogTitle>Ajustar stock</DialogTitle>
            <DialogDescription>{product.name} tiene {product.stock} unidades disponibles.</DialogDescription>
          </DialogHeader>
          <fieldset className="mt-5 grid grid-cols-2 gap-2">
            <legend className="sr-only">Tipo de ajuste</legend>
            {(["entry", "exit"] as const).map((value) => (
              <label key={value} className="flex cursor-pointer items-center gap-2 rounded-xl bg-[#f7f6f3] p-3 text-sm font-medium">
                <input type="radio" name="kind" checked={kind === value} onChange={() => setKind(value)} />
                {value === "entry" ? "Entrada" : "Salida"}
              </label>
            ))}
          </fieldset>
          <label className="mt-4 block space-y-1.5 text-sm font-medium">
            Cantidad
            <Input type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="h-11 rounded-xl bg-[#f7f6f3]" />
          </label>
          <p className="mt-3 rounded-xl bg-[#f7f6f3] px-3 py-2 text-sm font-medium">Stock resultante: {preview} {preview === 1 ? "unidad" : "unidades"}</p>
          {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <DialogFooter className="-mx-5 -mb-5 mt-5 p-5">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">Cancelar</Button>
            <Button type="submit" className="rounded-xl">Guardar ajuste</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
