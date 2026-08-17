"use client";

import { KeyRound, LoaderCircle } from "lucide-react";
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
import type { SafeUser } from "@/lib/auth/types";

type UserPasswordDialogProps = {
  user: SafeUser | null;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (password: string) => Promise<void>;
};

export const UserPasswordDialog = ({
  user,
  pending,
  error,
  onClose,
  onSubmit,
}: UserPasswordDialogProps) => {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password.length < 10) {
      setValidationError("La contraseña debe tener al menos 10 caracteres.");
      return;
    }
    if (password !== confirmation) {
      setValidationError("Las contraseñas no coinciden.");
      return;
    }
    setValidationError(null);
    await onSubmit(password);
  };

  const fullName = user ? user.firstName + " " + user.lastName : "";

  return (
    <Dialog open={user !== null} onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="rounded-[1.6rem] p-5 sm:max-w-md">
        <form onSubmit={submit}>
          <DialogHeader>
            <span className="mb-1 flex size-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
              <KeyRound className="size-5" />
            </span>
            <DialogTitle className="text-xl">Cambiar contraseña</DialogTitle>
            <DialogDescription>
              Asigná una nueva clave a {fullName}. Sus sesiones actuales se cerrarán.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 space-y-4">
            <label className="space-y-1.5 text-sm font-medium">
              Nueva contraseña
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                className="h-11 rounded-xl border-black/10 bg-[#f7f6f3]"
              />
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              Confirmar contraseña
              <Input
                type="password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="new-password"
                className="h-11 rounded-xl border-black/10 bg-[#f7f6f3]"
              />
            </label>
          </div>

          {(validationError || error) && (
            <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {validationError ?? error}
            </p>
          )}

          <DialogFooter className="-mx-5 -mb-5 mt-5 p-5">
            <Button type="button" variant="outline" disabled={pending} onClick={onClose} className="h-10 rounded-xl">
              Cancelar
            </Button>
            <Button type="submit" disabled={pending} className="h-10 rounded-xl">
              {pending && <LoaderCircle className="animate-spin" />}
              {pending ? "Cambiando..." : "Cambiar contraseña"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
