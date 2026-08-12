"use client";

import { Check, Copy, LoaderCircle, UserPlus } from "lucide-react";
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
import type { Role, SafeUser } from "@/lib/auth/types";
import { normalizeCommissionUser } from "@/lib/users/frontend-user-contracts";
import type { FrontendCreateUserInput, FrontendUpdateUserInput } from "@/types/user-commissions";
import { ROLE_LABELS } from "@/lib/users/presentation";

type UserEditorDialogProps = {
  mode: "create" | "edit" | null;
  user: SafeUser | null;
  roles: Role[];
  createdUser: SafeUser | null;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onCreate: (input: FrontendCreateUserInput) => Promise<boolean>;
  onUpdate: (changes: FrontendUpdateUserInput) => Promise<void>;
};

const fieldClassName =
  "h-11 rounded-xl border-black/10 bg-[#f7f6f3] shadow-none focus:bg-white";

export const UserEditorDialog = ({
  mode,
  user,
  roles,
  createdUser,
  pending,
  error,
  onClose,
  onCreate,
  onUpdate,
}: UserEditorDialogProps) => {
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [roleId, setRoleId] = useState<1 | 2 | 3>(user?.role.id ?? 3);
  const [password, setPassword] = useState("");
  const commissionUser = user ? normalizeCommissionUser(user) : null;
  const [serviceCommissionRate, setServiceCommissionRate] = useState(commissionUser?.serviceCommissionRate ?? 0);
  const [productCommissionRate, setProductCommissionRate] = useState(commissionUser?.productCommissionRate ?? 0);
  const [validationError, setValidationError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();
    if (!cleanFirstName || !cleanLastName) {
      setValidationError("Completá nombre y apellido.");
      return;
    }
    if (![serviceCommissionRate, productCommissionRate].every((rate) => Number.isInteger(rate) && rate >= 0 && rate <= 100)) {
      setValidationError("Las comisiones deben ser porcentajes enteros entre 0 y 100.");
      return;
    }

    setValidationError(null);
    if (mode === "create") {
      if (password.length < 10) {
        setValidationError("La contraseña debe tener al menos 10 caracteres.");
        return;
      }
      const created = await onCreate({
        firstName: cleanFirstName,
        lastName: cleanLastName,
        roleId,
        password,
        serviceCommissionRate,
        productCommissionRate,
      });
      if (created) setPassword("");
      return;
    }

    if (!user) return;
    const changes: FrontendUpdateUserInput = {};
    if (cleanFirstName !== user.firstName) changes.firstName = cleanFirstName;
    if (cleanLastName !== user.lastName) changes.lastName = cleanLastName;
    if (roleId !== user.role.id) changes.roleId = roleId;
    if (serviceCommissionRate !== commissionUser?.serviceCommissionRate) changes.serviceCommissionRate = serviceCommissionRate;
    if (productCommissionRate !== commissionUser?.productCommissionRate) changes.productCommissionRate = productCommissionRate;
    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }
    await onUpdate(changes);
  };

  const copyUsername = async () => {
    if (createdUser && navigator.clipboard) {
      await navigator.clipboard.writeText(createdUser.username);
    }
  };

  return (
    <Dialog open={mode !== null} onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto rounded-[1.6rem] p-5 sm:max-w-lg">
        {createdUser && mode === "create" ? (
          <div className="py-3 text-center" role="status" aria-live="polite">
            <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <Check className="size-6" />
            </span>
            <DialogTitle className="mt-4 text-2xl">Usuario creado</DialogTitle>
            <DialogDescription className="mx-auto mt-2 max-w-sm">
              Entregale este usuario junto con la contraseña que acabás de asignar.
            </DialogDescription>
            <div className="mx-auto mt-5 flex max-w-sm items-center gap-2 rounded-2xl bg-[#f4f2ee] p-2 pl-4">
              <code className="min-w-0 flex-1 truncate text-left text-base font-bold text-zinc-900">
                {createdUser.username}
              </code>
              <Button type="button" variant="outline" onClick={copyUsername} className="rounded-xl bg-white">
                <Copy /> Copiar usuario
              </Button>
            </div>
            <Button type="button" onClick={onClose} className="mt-5 h-11 w-full rounded-xl">
              Cerrar
            </Button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <DialogHeader>
              <span className="mb-1 flex size-10 items-center justify-center rounded-2xl bg-red-50 text-primary">
                <UserPlus className="size-5" />
              </span>
              <DialogTitle className="text-xl">
                {mode === "create" ? "Nuevo usuario" : "Editar usuario"}
              </DialogTitle>
              <DialogDescription>
                {mode === "create"
                  ? "El sistema generará el nombre de usuario automáticamente."
                  : "El nombre de usuario se mantiene estable para evitar confusiones."}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm font-medium">
                Nombre
                <Input
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  autoComplete="off"
                  className={fieldClassName}
                />
              </label>
              <label className="space-y-1.5 text-sm font-medium">
                Apellido
                <Input
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  autoComplete="off"
                  className={fieldClassName}
                />
              </label>

              {mode === "edit" && user && (
                <label className="space-y-1.5 text-sm font-medium sm:col-span-2">
                  Usuario
                  <Input
                    readOnly
                    value={user.username}
                    className={fieldClassName + " text-zinc-500"}
                  />
                </label>
              )}

              <label className="space-y-1.5 text-sm font-medium sm:col-span-2">
                Rol del usuario
                <select
                  disabled={roles.length === 0}
                  value={String(roleId)}
                  onChange={(event) => setRoleId(Number(event.target.value) as 1 | 2 | 3)}
                  className="h-11 w-full rounded-xl border border-black/10 bg-[#f7f6f3] px-3 text-sm outline-none focus:border-primary/50 focus:ring-3 focus:ring-primary/10"
                >
                  {roles.map((role) => (
                    <option key={role.id} value={String(role.id)}>
                      {ROLE_LABELS[role.name]}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-4 rounded-2xl bg-[#f7f6f3] p-4 sm:col-span-2 sm:grid-cols-2">
                <label className="space-y-1.5 text-sm font-medium">
                  Comisión por servicios (%)
                  <Input type="number" min="0" max="100" step="1" value={serviceCommissionRate} onChange={(event) => setServiceCommissionRate(Number(event.target.value))} className={fieldClassName} />
                </label>
                <label className="space-y-1.5 text-sm font-medium">
                  Comisión por productos (%)
                  <Input type="number" min="0" max="100" step="1" value={productCommissionRate} onChange={(event) => setProductCommissionRate(Number(event.target.value))} className={fieldClassName} />
                </label>
                <p className="text-xs text-zinc-500 sm:col-span-2">Los cambios se aplicarán a ventas futuras y no modificarán el historial.</p>
              </div>

              {mode === "create" && (
                <label className="space-y-1.5 text-sm font-medium sm:col-span-2">
                  Contraseña inicial
                  <Input
                    type="password"
                    aria-label="Contraseña inicial"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                    className={fieldClassName}
                  />
                  <span className="block text-xs font-normal text-zinc-500">
                    Mínimo 10 caracteres.
                  </span>
                </label>
              )}
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
              <Button type="submit" disabled={pending || roles.length === 0} className="h-10 rounded-xl">
                {pending && <LoaderCircle className="animate-spin" />}
                {pending
                  ? "Guardando..."
                  : mode === "create"
                    ? "Crear usuario"
                    : "Guardar cambios"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
