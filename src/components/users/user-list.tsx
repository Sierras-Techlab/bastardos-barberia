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
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SafeUser } from "@/lib/auth/types";
import type { EmployeeCommercialAgreement, ChairRentalPayment } from "@/types/chair-rental";
import {
  formatEffectiveCommissionRate,
  formatLastLogin,
  getUserInitials,
  ROLE_LABELS,
} from "@/lib/users/presentation";
import { formatChairRentalPeriod } from "@/lib/chair-rentals/presentation";

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
  agreements?: Record<string, EmployeeCommercialAgreement | null>;
  rentals?: Record<string, ChairRentalPayment | null>;
  canEditAgreement?: boolean;
  onAgreement?: (user: SafeUser) => void;
  onPayRental?: (user: SafeUser, rental: ChairRentalPayment) => void;
  onRentalHistory?: (user: SafeUser) => void;
};

const roleClasses = {
  owner: "border-amber-200 bg-amber-50 text-amber-800",
  admin: "border-sky-200 bg-sky-50 text-sky-800",
  employee: "border-zinc-200 bg-zinc-100 text-zinc-700",
} as const;

const rentalStatusLabels = {
  pending: "Pendiente",
  paid: "Pagado",
  overdue: "Vencido",
  voided: "Anulado",
} as const;

const rentalMoney = (amount: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);

export const UserList = ({
  users,
  currentUserId,
  onAction,
  agreements = {}, rentals = {}, canEditAgreement = false, onAgreement, onPayRental, onRentalHistory,
}: UserListProps) => (
  <div
    role="table"
    aria-label="Listado de usuarios"
    className="overflow-visible rounded-[1.5rem] border border-black/5 bg-white shadow-[0_24px_60px_-48px_rgba(0,0,0,0.45)]"
  >
    <div
      role="row"
      className="hidden grid-cols-[minmax(13rem,1.4fr)_8rem_7rem_9rem_9rem_11rem_9rem_3rem] gap-4 border-b border-black/5 px-5 py-3 text-[0.68rem] font-bold tracking-[0.14em] text-zinc-400 uppercase xl:grid"
    >
      <span role="columnheader">Usuario</span>
      <span role="columnheader">Rol</span>
      <span role="columnheader">Estado</span>
      <span role="columnheader">Comisión servicios</span>
      <span role="columnheader">Comisión productos</span>
      <span role="columnheader">Alquiler de silla</span>
      <span role="columnheader">Último acceso</span>
      <span role="columnheader" className="sr-only">Acciones</span>
    </div>

    <div role="rowgroup" className="divide-y divide-black/5">
      {users.map((user) => {
        const fullName = user.firstName + " " + user.lastName;
        const isSelf = user.id === currentUserId;
        const selfRestrictionId = "self-action-restriction-" + user.id;
        const isEmployee = user.role.name === "employee";
        const agreement = isEmployee ? agreements[user.id] : null;
        const serviceCommission = formatEffectiveCommissionRate(
          user.serviceCommissionRate,
          isEmployee ? agreement?.serviceCommissionEnabled ?? user.serviceCommissionEnabled : true,
        );
        const productCommission = formatEffectiveCommissionRate(
          user.productCommissionRate,
          isEmployee ? agreement?.productCommissionEnabled ?? user.productCommissionEnabled : true,
        );

        return (
          <div
            role="row"
            key={user.id}
            className="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 transition hover:bg-[#faf9f7] xl:grid-cols-[minmax(13rem,1.4fr)_8rem_7rem_9rem_9rem_11rem_9rem_3rem] xl:gap-4 xl:px-5"
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
                <div className="mt-2 flex flex-wrap gap-2 xl:hidden">
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
                <p className="mt-2 text-[0.7rem] text-zinc-400 xl:hidden">
                  Último acceso: {formatLastLogin(user.lastLoginAt)}
                </p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[0.7rem] text-zinc-500 xl:hidden">
                  <span
                    aria-label={`Comisión servicios de ${fullName}: ${serviceCommission}`}
                  >
                    Servicios {serviceCommission}
                  </span>
                  <span
                    aria-label={`Comisión productos de ${fullName}: ${productCommission}`}
                  >
                    Productos {productCommission}
                  </span>
                </div>
                {user.role.name === "employee" && agreements[user.id]?.chairRentalEnabled && rentals[user.id] && <div className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 xl:hidden"><span className="font-semibold">Alquiler de {formatChairRentalPeriod(rentals[user.id]?.period ?? "")}:</span> {rentalStatusLabels[rentals[user.id]?.status ?? "pending"]} · {rentalMoney(rentals[user.id]?.amount ?? 0)} · vence el día {agreements[user.id]?.chairRentalDueDay}{canEditAgreement && rentals[user.id]?.status !== "paid" && <Button type="button" variant="link" className="h-auto p-0 pl-2 text-xs" onClick={() => onPayRental?.(user, rentals[user.id] as ChairRentalPayment)}>Registrar pago de {formatChairRentalPeriod(rentals[user.id]?.period ?? "")}</Button>}</div>}
              </div>
            </div>

            <div role="cell" className="hidden xl:block">
              <Badge variant="outline" className={roleClasses[user.role.name]}>
                {ROLE_LABELS[user.role.name]}
              </Badge>
            </div>

            <div role="cell" className="hidden xl:block">
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
              aria-label={`Comisión servicios de ${fullName}: ${serviceCommission}`}
              className="hidden text-sm font-semibold text-zinc-700 xl:block"
            >
              {serviceCommission}
            </div>

            <div
              role="cell"
              aria-label={`Comisión productos de ${fullName}: ${productCommission}`}
              className="hidden text-sm font-semibold text-zinc-700 xl:block"
            >
              {productCommission}
            </div>

            <div role="cell" className="hidden min-w-0 xl:block">
              {user.role.name !== "employee" ? <span className="text-xs text-zinc-400">—</span> : !agreements[user.id] ? <span className="text-xs text-zinc-400">Sin acuerdo</span> : !agreements[user.id]?.chairRentalEnabled ? <span className="text-xs text-zinc-400">No configurado</span> : rentals[user.id] ? <div className="space-y-1 text-xs"><p className="font-semibold text-zinc-700"><span className="font-normal text-zinc-500">Período facturado: </span>{formatChairRentalPeriod(rentals[user.id]?.period ?? "")} · {rentalMoney(rentals[user.id]?.amount ?? 0)}</p><p className="text-zinc-500">{rentalStatusLabels[rentals[user.id]?.status ?? "pending"]} · vence el día {agreements[user.id]?.chairRentalDueDay}</p>{canEditAgreement && rentals[user.id]?.status !== "paid" && <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={() => onPayRental?.(user, rentals[user.id] as ChairRentalPayment)}>Registrar pago de {formatChairRentalPeriod(rentals[user.id]?.period ?? "")}</Button>}</div> : <span className="text-xs text-zinc-400">Sin obligación</span>}
            </div>

            <div role="cell" className="hidden text-xs text-zinc-500 xl:block">
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
                  {user.role.name === "employee" && <><DropdownMenuItem onClick={() => onAgreement?.(user)} className="gap-2 rounded-lg px-3 py-2">{canEditAgreement ? "Editar acuerdo" : "Ver acuerdo"}</DropdownMenuItem><DropdownMenuItem onClick={() => onRentalHistory?.(user)} className="gap-2 rounded-lg px-3 py-2">Ver alquileres</DropdownMenuItem></>}
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
