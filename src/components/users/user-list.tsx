"use client";

import {
  KeyRound,
  MoreHorizontal,
  Pencil,
  Power,
  PowerOff,
  Trash2,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SafeUser } from "@/lib/auth/types";
import {
  formatLastLogin,
  getUserInitials,
  ROLE_LABELS,
} from "@/lib/users/presentation";

export type UserAction =
  | "edit"
  | "password"
  | "activate"
  | "deactivate"
  | "delete";

type UserListProps = {
  users: SafeUser[];
  currentUserId: string;
  onAction: (action: UserAction, user: SafeUser) => void;
};

const roleClasses = {
  owner: "border-amber-200 bg-amber-50 text-amber-800",
  admin: "border-sky-200 bg-sky-50 text-sky-800",
  employee: "border-zinc-200 bg-zinc-100 text-zinc-700",
} as const;

export const UserList = ({
  users,
  currentUserId,
  onAction,
}: UserListProps) => (
  <div
    role="table"
    aria-label="Listado de usuarios"
    className="overflow-visible rounded-[1.5rem] border border-black/5 bg-white shadow-[0_24px_60px_-48px_rgba(0,0,0,0.45)]"
  >
    <div
      role="row"
      className="hidden grid-cols-[minmax(13rem,1.4fr)_8rem_7rem_9rem_9rem_9rem_3rem] gap-4 border-b border-black/5 px-5 py-3 text-[0.68rem] font-bold tracking-[0.14em] text-zinc-400 uppercase md:grid"
    >
      <span role="columnheader">Usuario</span>
      <span role="columnheader">Rol</span>
      <span role="columnheader">Estado</span>
      <span role="columnheader">Comisión servicios</span>
      <span role="columnheader">Comisión productos</span>
      <span role="columnheader">Último acceso</span>
      <span role="columnheader" className="sr-only">Acciones</span>
    </div>

    <div role="rowgroup" className="divide-y divide-black/5">
      {users.map((user) => {
        const fullName = user.firstName + " " + user.lastName;
        const isSelf = user.id === currentUserId;
        const selfRestrictionId = "self-action-restriction-" + user.id;

        return (
          <div
            role="row"
            key={user.id}
            className="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 transition hover:bg-[#faf9f7] md:grid-cols-[minmax(13rem,1.4fr)_8rem_7rem_9rem_9rem_9rem_3rem] md:gap-4 md:px-5"
          >
            <div role="cell" className="flex min-w-0 items-center gap-3">
              <Avatar className="size-10 shrink-0 border border-black/5">
                <AvatarFallback className="bg-[#f3f1ed] text-xs font-bold text-zinc-700">
                  {getUserInitials(user)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold text-zinc-900">{fullName}</p>
                  {isSelf && (
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[0.65rem] font-semibold text-zinc-500">
                      Vos
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-zinc-500">@{user.username}</p>
                <div className="mt-2 flex flex-wrap gap-2 md:hidden">
                  <Badge variant="outline" className={roleClasses[user.role.name]}>
                    {ROLE_LABELS[user.role.name]}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={user.isActive
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-zinc-200 bg-zinc-100 text-zinc-500"}
                  >
                    {user.isActive ? "Activo" : "Inactivo"}
                  </Badge>
                </div>
                <p className="mt-2 text-[0.7rem] text-zinc-400 md:hidden">
                  Último acceso: {formatLastLogin(user.lastLoginAt)}
                </p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[0.7rem] text-zinc-500 md:hidden">
                  <span
                    aria-label={`Comisión servicios de ${fullName}: ${user.serviceCommissionRate}%`}
                  >
                    Servicios {user.serviceCommissionRate}%
                  </span>
                  <span
                    aria-label={`Comisión productos de ${fullName}: ${user.productCommissionRate}%`}
                  >
                    Productos {user.productCommissionRate}%
                  </span>
                </div>
              </div>
            </div>

            <div role="cell" className="hidden md:block">
              <Badge variant="outline" className={roleClasses[user.role.name]}>
                {ROLE_LABELS[user.role.name]}
              </Badge>
            </div>

            <div role="cell" className="hidden md:block">
              <Badge
                variant="outline"
                className={user.isActive
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-zinc-200 bg-zinc-100 text-zinc-500"}
              >
                <span
                  aria-hidden="true"
                  className={user.isActive
                    ? "size-1.5 rounded-full bg-emerald-500"
                    : "size-1.5 rounded-full bg-zinc-400"}
                />
                {user.isActive ? "Activo" : "Inactivo"}
              </Badge>
            </div>

            <div
              role="cell"
              aria-label={`Comisión servicios de ${fullName}: ${user.serviceCommissionRate}%`}
              className="hidden text-sm font-semibold text-zinc-700 md:block"
            >
              {user.serviceCommissionRate}%
            </div>

            <div
              role="cell"
              aria-label={`Comisión productos de ${fullName}: ${user.productCommissionRate}%`}
              className="hidden text-sm font-semibold text-zinc-700 md:block"
            >
              {user.productCommissionRate}%
            </div>

            <div role="cell" className="hidden text-xs text-zinc-500 md:block">
              {formatLastLogin(user.lastLoginAt)}
            </div>

            <div role="cell" className="relative justify-self-end">
              {isSelf && (
                <span id={selfRestrictionId} className="sr-only">
                  Tu propia cuenta no se puede desactivar ni eliminar.
                </span>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger
                  type="button"
                  aria-label={"Acciones de " + fullName}
                  aria-describedby={isSelf ? selfRestrictionId : undefined}
                  className={buttonVariants({
                    variant: "ghost",
                    size: "icon",
                    className: "rounded-xl text-zinc-500",
                  })}
                >
                  <MoreHorizontal />
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-56 rounded-xl border-black/8 p-1.5 shadow-xl"
                >
                  <DropdownMenuItem
                    onClick={() => onAction("edit", user)}
                    className="gap-2 rounded-lg px-3 py-2"
                  >
                    <Pencil /> Editar datos
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onAction("password", user)}
                    className="gap-2 rounded-lg px-3 py-2"
                  >
                    <KeyRound /> Cambiar contraseña
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    aria-disabled={isSelf}
                    aria-describedby={isSelf ? selfRestrictionId : undefined}
                    closeOnClick={!isSelf}
                    onClick={(event) => {
                      if (isSelf) {
                        event.preventDefault();
                        return;
                      }
                      onAction(user.isActive ? "deactivate" : "activate", user);
                    }}
                    className="gap-2 rounded-lg px-3 py-2 aria-disabled:cursor-not-allowed aria-disabled:opacity-40"
                  >
                    {user.isActive ? <PowerOff /> : <Power />}
                    {user.isActive ? "Desactivar usuario" : "Activar usuario"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    aria-disabled={isSelf}
                    aria-describedby={isSelf ? selfRestrictionId : undefined}
                    closeOnClick={!isSelf}
                    onClick={(event) => {
                      if (isSelf) {
                        event.preventDefault();
                        return;
                      }
                      onAction("delete", user);
                    }}
                    className="gap-2 rounded-lg px-3 py-2 aria-disabled:cursor-not-allowed aria-disabled:opacity-40"
                  >
                    <Trash2 /> Eliminar usuario
                  </DropdownMenuItem>
                  {isSelf && (
                    <p
                      className="mx-2 mt-1 border-t border-zinc-100 pt-2 pb-1 text-xs leading-snug text-zinc-500"
                    >
                      Tu propia cuenta no se puede desactivar ni eliminar.
                    </p>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);
