"use client";

import { Pencil, Plus, Tags } from "lucide-react";
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
import type { ProductCategoryClient } from "@/lib/product-categories/client";
import type { ProductCategory } from "@/types/product-category";

type ProductCategoriesDialogProps = {
  categories: ProductCategory[];
  categoryClient: Pick<ProductCategoryClient, "create" | "update" | "deactivate">;
  onCategoriesChange: (categories: ProductCategory[]) => void;
  onClose: () => void;
};

const fieldClassName =
  "h-10 rounded-xl border-black/10 bg-[#f7f6f3] shadow-none focus:bg-white";

const messageFor = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "No se pudo actualizar la categoría.";

export const ProductCategoriesDialog = ({
  categories: initialCategories,
  categoryClient,
  onCategoriesChange,
  onClose,
}: ProductCategoriesDialogProps) => {
  const [categories, setCategories] = useState(initialCategories);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<ProductCategory | null>(null);
  const [editingName, setEditingName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const replaceCategories = (next: ProductCategory[]) => {
    setCategories(next);
    onCategoriesChange(next);
  };

  const create = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      const category = await categoryClient.create({ name: newName });
      replaceCategories([...categories, category]);
      setNewName("");
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setIsSaving(false);
    }
  };

  const rename = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing || isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      const category = await categoryClient.update(editing.id, { name: editingName });
      replaceCategories(
        categories.map((current) => current.id === category.id ? category : current),
      );
      setEditing(null);
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setIsSaving(false);
    }
  };

  const setActive = async (category: ProductCategory) => {
    if (isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      const updated = category.isActive
        ? await categoryClient.deactivate(category.id)
        : await categoryClient.update(category.id, { isActive: true });
      replaceCategories(
        categories.map((current) => current.id === updated.id ? updated : current),
      );
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !isSaving && onClose()}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto rounded-[1.6rem] p-5 sm:max-w-xl">
        <DialogHeader>
          <span className="mb-1 flex size-10 items-center justify-center rounded-2xl bg-red-50 text-primary">
            <Tags className="size-5" />
          </span>
          <DialogTitle>Administrar categorías</DialogTitle>
          <DialogDescription>
            Organizá el catálogo sin perder el historial de productos.
          </DialogDescription>
        </DialogHeader>

        <form className="mt-4 flex gap-2" onSubmit={create}>
          <Input
            aria-label="Nueva categoría"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Nueva categoría"
            className={fieldClassName}
          />
          <Button type="submit" className="h-10 rounded-xl" disabled={isSaving}>
            <Plus /> Agregar categoría
          </Button>
        </form>

        {editing && (
          <form className="mt-4 rounded-xl bg-[#f7f6f3] p-3" onSubmit={rename}>
            <label className="space-y-1.5 text-sm font-medium">
              Nombre de la categoría
              <Input
                value={editingName}
                onChange={(event) => setEditingName(event.target.value)}
                className={fieldClassName}
              />
            </label>
            <div className="mt-3 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setEditing(null)} disabled={isSaving}>
                Cancelar
              </Button>
              <Button type="submit" className="rounded-xl" disabled={isSaving}>
                Guardar nombre
              </Button>
            </div>
          </form>
        )}

        <ul className="mt-4 divide-y divide-black/5 rounded-xl border border-black/5">
          {categories.map((category) => (
            <li key={category.id} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{category.name}</p>
                <p className="text-xs text-muted-foreground">
                  {category.isActive ? "Activa" : "Inactiva"}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Renombrar ${category.name}`}
                  disabled={isSaving}
                  onClick={() => {
                    setEditing(category);
                    setEditingName(category.name);
                    setError(null);
                  }}
                >
                  <Pencil />
                </Button>
                <Button
                  type="button"
                  variant={category.isActive ? "outline" : "default"}
                  className="rounded-xl"
                  disabled={isSaving}
                  onClick={() => setActive(category)}
                >
                  {category.isActive ? `Desactivar ${category.name}` : `Reactivar ${category.name}`}
                </Button>
              </div>
            </li>
          ))}
        </ul>

        {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <DialogFooter className="-mx-5 -mb-5 mt-5 p-5">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving} className="rounded-xl">
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
