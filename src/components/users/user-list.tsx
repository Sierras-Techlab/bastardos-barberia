"use client";

import {
  KeyRound,
  MoreHorizontal,
  Pencil,
  Power,
  PowerOff,
  Trash2,
} from "lucide-react";
import { useState } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
}: UserListProps) => {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const choose = (action: UserAction, user: SafeUser) => {
    setOpenMenuId(null);
    onAction(action, user);
  };

  return (
    <div
      role="table"
      aria-label="Listado de usuarios"
      className="overflow-visible rounded-[1.5rem] border border-black/5 bg-white shadow-[0_24px_60px_-48px_rgba(0,0,0,0.45)]"
    >
      <div
        role="row"
        className="hidden grid-cols-[minmax(15rem,1.5fr)_11rem_9rem_11rem_3rem] gap-4 border-b border-black/5 px-5 py-3 text-[0.68rem] font-bold tracking-[0.14em] text-zinc-400 uppercase md:grid"
      >
        <span role="columnheader">Usuario</span>
        <span role="columnheader">Rol</span>
        <span role="columnheader">Estado</span>
        <span role="columnheader">Último acceso</span>
        <span role="columnheader" className="sr-only">Acciones</span>
      </div>

      <div role="rowgroup" className="divide-y divide-black/5">
        {users.map((user) => {
          const fullName = user.firstName + " " + user.lastName;
          const isSelf = user.id === currentUserId;
          const menuOpen = openMenuId === user.id;

          return (
            <div
              role="row"
              key={user.id}
              className="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 transition hover:bg-[#faf9f7] md:grid-cols-[minmax(15rem,1.5fr)_11rem_9rem_11rem_3rem] md:gap-4 md:px-5"
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

              <div role="cell" className="hidden text-xs text-zinc-500 md:block">
                {formatLastLogin(user.lastLoginAt)}
              </div>

              <div role="cell" className="relative justify-self-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={"Acciones de " + fullName}
                  aria-expanded={menuOpen}
                  onClick={() => setOpenMenuId(menuOpen ? null : user.id)}
                  className="rounded-xl text-zinc-500"
                >
                  <MoreHorizontal />
                </Button>

                {menuOpen && (
                  <div
                    role="menu"
                    className="absolute top-10 right-0 z-30 w-56 rounded-xl border border-black/8 bg-white p-1.5 shadow-xl"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => choose("edit", user)}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-zinc-100"
                    >
                      <Pencil className="size-4" /> Editar datos
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => choose("password", user)}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-zinc-100"
                    >
                      <KeyRound className="size-4" /> Cambiar contraseña
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      disabled={isSelf}
                      title={isSelf ? "No podés cambiar el estado de tu propia cuenta." : undefined}
                      onClick={() => choose(user.isActive ? "deactivate" : "activate", user)}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {user.isActive
                        ? <PowerOff className="size-4" />
                        : <Power className="size-4" />}
                      {user.isActive ? "Desactivar usuario" : "Activar usuario"}
                    </button>
                    <div className="my-1 h-px bg-zinc-100" />
                    <button
                      type="button"
                      role="menuitem"
                      disabled={isSelf}
                      title={isSelf ? "No podés eliminar tu propia cuenta." : undefined}
                      onClick={() => choose("delete", user)}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Trash2 className="size-4" /> Eliminar usuario
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
