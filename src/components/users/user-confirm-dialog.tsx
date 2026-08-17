"use client";

import {
  LoaderCircle,
  Power,
  PowerOff,
  TriangleAlert,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SafeUser } from "@/lib/auth/types";

export type ConfirmUserAction = "activate" | "deactivate" | "delete";

type UserConfirmDialogProps = {
  action: ConfirmUserAction | null;
  user: SafeUser | null;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
};

const content = {
  activate: {
    title: "Activar usuario",
    confirm: "Activar usuario",
    pending: "Activando...",
  },
  deactivate: {
    title: "Desactivar usuario",
    confirm: "Desactivar usuario",
    pending: "Desactivando...",
  },
  delete: {
    title: "Eliminar usuario",
    confirm: "Eliminar usuario",
    pending: "Eliminando...",
  },
} as const;

export const UserConfirmDialog = ({
  action,
  user,
  pending,
  error,
  onClose,
  onConfirm,
}: UserConfirmDialogProps) => {
  const fullName = user ? user.firstName + " " + user.lastName : "";
  const copy = action ? content[action] : content.deactivate;

  const description = action === "activate"
    ? fullName + " recuperará el acceso con su contraseña actual."
    : action === "delete"
      ? fullName + " dejará de aparecer en la operación normal. Su historial se conservará para auditoría."
      : fullName + " no podrá ingresar y sus sesiones abiertas se cerrarán.";

  const Icon = action === "activate"
    ? Power
    : action === "delete"
      ? TriangleAlert
      : PowerOff;

  return (
    <Dialog open={action !== null && user !== null} onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="rounded-[1.6rem] p-5 sm:max-w-md">
        <DialogHeader>
          <span className={action === "delete"
            ? "mb-1 flex size-11 items-center justify-center rounded-2xl bg-red-50 text-red-600"
            : "mb-1 flex size-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-700"}
          >
            <Icon className="size-5" />
          </span>
          <DialogTitle className="text-xl">{copy.title}</DialogTitle>
          <DialogDescription className="leading-relaxed">
            {description}
          </DialogDescription>
        </DialogHeader>

        {action === "delete" && (
          <div className="rounded-xl border border-red-100 bg-red-50/70 px-3 py-2.5 text-xs leading-relaxed text-red-700">
            Esta acción no se puede deshacer desde el panel.
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <DialogFooter className="-mx-5 -mb-5 mt-2 p-5">
          <Button type="button" variant="outline" disabled={pending} onClick={onClose} className="h-10 rounded-xl">
            Cancelar
          </Button>
          <Button
            type="button"
            variant={action === "delete" ? "destructive" : "default"}
            disabled={pending}
            onClick={onConfirm}
            className="h-10 rounded-xl"
          >
            {pending && <LoaderCircle className="animate-spin" />}
            {pending ? copy.pending : copy.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
