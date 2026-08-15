"use client";

import { Pencil, Plus, Trash2, WalletCards } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { PaymentMethodDeleteDialog } from "@/components/incomes/payment-method-delete-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { PaymentMethodClient } from "@/lib/payment-methods/client";
import type { PaymentMethod } from "@/types/payment-method";

type Props = {
  methods: PaymentMethod[];
  paymentMethodClient: Pick<PaymentMethodClient, "create" | "update" | "deactivate" | "remove">;
  onMethodsChange: (methods: PaymentMethod[]) => void;
  onClose: () => void;
};

const fieldClassName = "h-10 rounded-xl border-black/10 bg-[#f7f6f3] shadow-none focus:bg-white";
const messageFor = (error: unknown) => error instanceof Error ? error.message : "No se pudo actualizar el medio de pago.";

export const PaymentMethodsDialog = ({ methods: initialMethods, paymentMethodClient, onMethodsChange, onClose }: Props) => {
  const [methods, setMethods] = useState(initialMethods);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<PaymentMethod | null>(null);
  const [editingName, setEditingName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [deleting, setDeleting] = useState<PaymentMethod | null>(null);

  const inactiveCount = methods.filter((method) => !method.isActive).length;
  const visibleMethods = methods.filter((method) => method.isActive !== showInactive);

  const replace = (next: PaymentMethod[]) => {
    setMethods(next);
    onMethodsChange(next);
  };

  const create = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const created = await paymentMethodClient.create({ name: newName });
      replace([...methods, created]);
      setNewName("");
      toast.success("Medio de pago creado correctamente.");
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setSaving(false);
    }
  };

  const rename = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing || saving) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await paymentMethodClient.update(editing.id, { name: editingName });
      replace(methods.map((method) => method.id === updated.id ? updated : method));
      setEditing(null);
      toast.success("Medio de pago actualizado correctamente.");
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setSaving(false);
    }
  };

  const setActive = async (method: PaymentMethod) => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const updated = method.isActive
        ? await paymentMethodClient.deactivate(method.id)
        : await paymentMethodClient.update(method.id, { isActive: true });
      replace(methods.map((current) => current.id === updated.id ? updated : current));
      toast.success(method.isActive ? "Medio de pago desactivado correctamente." : "Medio de pago reactivado correctamente.");
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (method: PaymentMethod) => {
    await paymentMethodClient.remove(method.id);
    replace(methods.filter((current) => current.id !== method.id));
    toast.success("Medio de pago eliminado correctamente.");
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto rounded-[1.6rem] p-5 sm:max-w-xl">
        <DialogHeader>
          <span className="mb-1 flex size-10 items-center justify-center rounded-2xl bg-red-50 text-primary"><WalletCards className="size-5" /></span>
          <DialogTitle>Administrar medios de pago</DialogTitle>
          <DialogDescription>Actualizá las opciones disponibles sin perder los nombres guardados en ventas anteriores.</DialogDescription>
        </DialogHeader>

        <form className="mt-4 flex gap-2" onSubmit={create}>
          <Input aria-label="Nuevo medio de pago" value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Nuevo medio de pago" className={fieldClassName} />
          <Button type="submit" className="h-10 rounded-xl" disabled={saving}><Plus /> Agregar medio</Button>
        </form>

        {editing && (
          <form className="mt-4 rounded-xl bg-[#f7f6f3] p-3" onSubmit={rename}>
            <label className="space-y-1.5 text-sm font-medium">Nombre del medio de pago<Input aria-label="Nombre del medio de pago" value={editingName} onChange={(event) => setEditingName(event.target.value)} className={fieldClassName} /></label>
            <div className="mt-3 flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setEditing(null)} disabled={saving}>Cancelar</Button><Button type="submit" className="rounded-xl" disabled={saving}>Guardar nombre</Button></div>
          </form>
        )}

        <div className="mt-4 flex items-center justify-between gap-3">
          <div>
            <p className="font-medium">{showInactive ? "Medios desactivados" : "Medios activos"}</p>
            <p className="text-xs text-muted-foreground">
              {showInactive ? "Podés restaurarlos o eliminarlos si nunca se usaron." : "Disponibles al momento de registrar una venta."}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="shrink-0 rounded-xl"
            onClick={() => {
              setShowInactive((current) => !current);
              setEditing(null);
              setError(null);
            }}
            disabled={saving}
          >
            {showInactive ? "Volver a activos" : `Ver desactivados (${inactiveCount})`}
          </Button>
        </div>

        {visibleMethods.length > 0 ? (
          <ul className="divide-y divide-black/5 rounded-xl border border-black/5">
          {visibleMethods.map((method) => (
            <li key={method.id} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0"><p className="truncate font-medium">{method.name}</p><p className="text-xs text-muted-foreground">{method.isActive ? "Activo" : "Inactivo"}</p></div>
              <div className="flex shrink-0 gap-1">
                <Button type="button" variant="ghost" size="icon" aria-label={`Renombrar ${method.name}`} disabled={saving} onClick={() => { setEditing(method); setEditingName(method.name); setError(null); }}><Pencil /></Button>
                <Button type="button" variant="ghost" size="icon" aria-label={`Eliminar ${method.name}`} disabled={saving} onClick={() => { setDeleting(method); setError(null); }} className="text-destructive hover:bg-red-50 hover:text-destructive"><Trash2 /></Button>
                <Button type="button" variant={method.isActive ? "outline" : "default"} className="rounded-xl" disabled={saving} onClick={() => setActive(method)}>{method.isActive ? `Desactivar ${method.name}` : `Reactivar ${method.name}`}</Button>
              </div>
            </li>
          ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-black/10 bg-[#f7f6f3] px-4 py-6 text-center text-sm text-muted-foreground">
            {showInactive ? "No hay medios de pago desactivados." : "Todavía no hay medios de pago activos."}
          </p>
        )}

        {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <DialogFooter className="-mx-5 -mb-5 mt-5 p-5"><Button type="button" variant="outline" onClick={onClose} disabled={saving} className="rounded-xl">Cerrar</Button></DialogFooter>
      </DialogContent>
      {deleting && (
        <PaymentMethodDeleteDialog
          method={deleting}
          onClose={() => setDeleting(null)}
          onConfirm={() => remove(deleting)}
        />
      )}
    </Dialog>
  );
};
