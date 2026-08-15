"use client";

import { Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ProductCategoryDeleteDialog } from "@/components/products/product-category-delete-dialog";
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
  categoryClient: Pick<
    ProductCategoryClient,
    "create" | "update" | "deactivate" | "remove"
  >;
  onCategoriesChange: (categories: ProductCategory[]) => void;
  onClose: () => void;
};

const fieldClassName =
  "h-10 rounded-xl border-black/10 bg-[#f7f6f3] shadow-none focus:bg-white";
const activeBadgeClassName =
  "shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700";
const inactiveBadgeClassName =
  "shrink-0 rounded-full bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-700";

const messageFor = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "No se pudo actualizar la categoría.";

const hasCode = (error: unknown, code: string) =>
  Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === code,
  );

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
  const [showInactive, setShowInactive] = useState(false);
  const [deleting, setDeleting] = useState<ProductCategory | null>(null);
  const [blockedDeactivationIds, setBlockedDeactivationIds] = useState<Set<string>>(
    () => new Set(),
  );

  const replaceCategories = (next: ProductCategory[]) => {
    setCategories(next);
    onCategoriesChange(next);
  };

  const inactiveCount = categories.filter((category) => !category.isActive).length;
  const visibleCategories = categories.filter(
    (category) => category.isActive !== showInactive,
  );

  const create = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      const category = await categoryClient.create({ name: newName });
      replaceCategories([...categories, category]);
      setNewName("");
      toast.success("Categoría creada correctamente.");
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
      toast.success("Categoría actualizada correctamente.");
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
      toast.success(
        category.isActive
          ? "Categoría desactivada correctamente."
          : "Categoría reactivada correctamente.",
      );
    } catch (caught) {
      if (category.isActive && hasCode(caught, "PRODUCT_CATEGORY_IN_USE")) {
        setBlockedDeactivationIds((current) => new Set(current).add(category.id));
      }
      setError(messageFor(caught));
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async (category: ProductCategory) => {
    await categoryClient.remove(category.id);
    replaceCategories(
      categories.filter((current) => current.id !== category.id),
    );
    toast.success("Categoría eliminada correctamente.");
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

        <form
          className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"
          onSubmit={create}
        >
          <Input
            aria-label="Nueva categoría"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Nueva categoría"
            className={fieldClassName}
          />
          <Button
            type="submit"
            className="h-10 w-full rounded-xl sm:w-auto"
            disabled={isSaving}
          >
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

        <div className="mt-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">
              {showInactive ? "Categorías desactivadas" : "Categorías activas"}
            </p>
            <p className="text-xs text-muted-foreground">
              {showInactive
                ? "Podés restaurarlas o eliminarlas si nunca se usaron."
                : "Disponibles para organizar nuevos productos."}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-xl bg-white"
            onClick={() => {
              setShowInactive((current) => !current);
              setEditing(null);
              setError(null);
            }}
            disabled={isSaving}
          >
            {showInactive
              ? "Volver a activas"
              : `Ver desactivadas (${inactiveCount})`}
          </Button>
        </div>

        {visibleCategories.length > 0 ? (
          <ul className="grid gap-2">
            {visibleCategories.map((category) => (
              <li
                key={category.id}
                data-testid={`product-category-card-${category.id}`}
                className="rounded-2xl border border-black/5 bg-[#f7f6f3] p-3 transition-colors hover:border-black/10 hover:bg-white"
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <p className="min-w-0 truncate font-medium">{category.name}</p>
                  <span
                    className={
                      category.isActive
                        ? activeBadgeClassName
                        : inactiveBadgeClassName
                    }
                  >
                    {category.isActive ? "Activa" : "Inactiva"}
                  </span>
                </div>
                <div
                  role="group"
                  aria-label={`Acciones para ${category.name}`}
                  className="mt-3 flex items-center gap-2"
                >
                <Button
                  type="button"
                  variant="outline"
                  aria-label={`Editar ${category.name}`}
                  className="h-9 min-w-0 flex-1 rounded-xl bg-white px-2 text-xs sm:text-sm"
                  disabled={isSaving}
                  onClick={() => {
                    setEditing(category);
                    setEditingName(category.name);
                    setError(null);
                  }}
                >
                  <Pencil /> Editar
                </Button>
                <Button
                  type="button"
                  variant={category.isActive ? "outline" : "default"}
                  aria-label={`${category.isActive ? "Desactivar" : "Reactivar"} ${category.name}`}
                  className={
                    category.isActive
                      ? "h-9 min-w-0 flex-1 rounded-xl bg-white px-2 text-xs sm:text-sm"
                      : "h-9 min-w-0 flex-1 rounded-xl px-2 text-xs sm:text-sm"
                  }
                  disabled={
                    isSaving ||
                    (category.isActive && blockedDeactivationIds.has(category.id))
                  }
                  onClick={() => setActive(category)}
                >
                  {category.isActive ? "Desactivar" : "Reactivar"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Eliminar ${category.name}`}
                  disabled={isSaving}
                  onClick={() => {
                    setDeleting(category);
                    setError(null);
                  }}
                  className="size-9 shrink-0 rounded-xl text-destructive hover:bg-red-50 hover:text-destructive"
                >
                  <Trash2 />
                </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-black/10 bg-[#f7f6f3] px-4 py-6 text-center text-sm text-muted-foreground">
            {showInactive
              ? "No hay categorías desactivadas."
              : "Todavía no hay categorías activas."}
          </p>
        )}

        {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <DialogFooter className="-mx-5 -mb-5 mt-5 p-5">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving} className="rounded-xl">
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
      {deleting && (
        <ProductCategoryDeleteDialog
          category={deleting}
          onClose={() => setDeleting(null)}
          onConfirm={() => remove(deleting)}
        />
      )}
    </Dialog>
  );
};
