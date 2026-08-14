"use client";

import { PackagePlus } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import {
  productEditorSchema,
  validateUniqueProductName,
} from "@/lib/products/product-management";
import type {
  CatalogProduct,
  ProductEditorInput,
} from "@/types/product";
import type { ProductCategory } from "@/types/product-category";

type ProductEditorDialogProps = {
  mode: "create" | "edit";
  product: CatalogProduct | null;
  products: CatalogProduct[];
  categories: ProductCategory[];
  onClose: () => void;
  onSave: (input: ProductEditorInput) => Promise<void> | void;
};

const fieldClassName =
  "h-11 rounded-xl border-black/10 bg-[#f7f6f3] shadow-none focus:bg-white";

export const ProductEditorDialog = ({
  mode,
  product,
  products,
  categories,
  onClose,
  onSave,
}: ProductEditorDialogProps) => {
  const [name, setName] = useState(product?.name ?? "");
  const activeCategories = categories.filter((category) => category.isActive);
  const currentCategory = product
    ? categories.find((category) => category.id === product.category.id)
    : null;
  const [categoryId, setCategoryId] = useState(
    currentCategory?.isActive ? currentCategory.id : (activeCategories[0]?.id ?? ""),
  );
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [stock, setStock] = useState(product ? String(product.stock) : "");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (savingRef.current) return;
    const input = {
      name,
      categoryId,
      price: Number(price),
      stock: mode === "edit" && product ? product.stock : Number(stock),
    };
    const parsed = productEditorSchema.safeParse(input);

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revisá los datos ingresados.");
      return;
    }

    const duplicateError = validateUniqueProductName(
      parsed.data.name,
      products,
      product?.id,
    );
    if (duplicateError) {
      setError(duplicateError);
      return;
    }

    savingRef.current = true;
    setIsSaving(true);
    setError(null);
    try {
      await onSave(parsed.data);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "No se pudo guardar el producto.",
      );
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !isSaving && onClose()}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto rounded-[1.6rem] p-5 sm:max-w-lg">
        <form onSubmit={submit}>
          <DialogHeader>
            <span className="mb-1 flex size-10 items-center justify-center rounded-2xl bg-red-50 text-primary">
              <PackagePlus className="size-5" />
            </span>
            <DialogTitle className="text-xl">
              {mode === "create" ? "Nuevo producto" : "Editar producto"}
            </DialogTitle>
            <DialogDescription>
              {mode === "create"
                ? "Agregá un producto al catálogo de la barbería."
                : "Actualizá los datos comerciales sin modificar el stock."}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm font-medium sm:col-span-2">
              Nombre
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={fieldClassName}
                autoComplete="off"
              />
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              Categoría
              <select
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                className="h-11 w-full rounded-xl border border-black/10 bg-[#f7f6f3] px-3 text-sm outline-none focus:border-primary/50 focus:ring-3 focus:ring-primary/10"
              >
                {activeCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              Precio
              <Input
                type="number"
                min="0"
                step="1"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                className={fieldClassName}
              />
            </label>
            {mode === "create" && (
              <label className="space-y-1.5 text-sm font-medium sm:col-span-2">
                Stock inicial
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={stock}
                  onChange={(event) => setStock(event.target.value)}
                  className={fieldClassName}
                />
              </label>
            )}
          </div>

          {error && (
            <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <DialogFooter className="-mx-5 -mb-5 mt-5 p-5">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving} className="h-10 rounded-xl">
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving} className="h-10 rounded-xl">
              {isSaving
                ? "Guardando..."
                : mode === "create"
                  ? "Crear producto"
                  : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
