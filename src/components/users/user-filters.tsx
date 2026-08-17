"use client";

import { RotateCcw, Search, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Role } from "@/lib/auth/types";
import { ROLE_LABELS } from "@/lib/users/presentation";

export type UserFiltersValue = {
  search: string;
  roleId: "all" | "1" | "2" | "3";
  status: "all" | "active" | "inactive";
};

type UserFiltersProps = {
  roles: Role[];
  value: UserFiltersValue;
  onChange: (value: UserFiltersValue) => void;
  onClear: () => void;
};

const selectClassName =
  "h-11 w-full rounded-xl border border-black/8 bg-[#f7f6f3] px-3 text-sm outline-none transition focus:border-primary/50 focus:bg-white focus:ring-3 focus:ring-primary/10";

export const UserFilters = ({
  roles,
  value,
  onChange,
  onClear,
}: UserFiltersProps) => {
  const canClear = value.search !== ""
    || value.roleId !== "all"
    || value.status !== "all";

  return (
    <section
      aria-label="Filtros de usuarios"
      className="rounded-[1.4rem] border border-black/5 bg-white p-3 shadow-[0_18px_45px_-38px_rgba(0,0,0,0.42)] sm:p-4"
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_13rem_13rem_auto]">
        <label className="relative block">
          <span className="sr-only">Buscar usuarios</span>
          <Search className="pointer-events-none absolute top-3.5 left-3.5 size-4 text-zinc-400" />
          <Input
            type="search"
            value={value.search}
            onChange={(event) => onChange({ ...value, search: event.target.value })}
            placeholder="Buscar por nombre o usuario"
            aria-label="Buscar usuarios"
            className="h-11 rounded-xl border-black/8 bg-[#f7f6f3] pl-10 shadow-none"
          />
        </label>

        <label className="space-y-1">
          <span className="sr-only">Rol</span>
          <select
            aria-label="Rol"
            value={value.roleId}
            onChange={(event) => onChange({
              ...value,
              roleId: event.target.value as UserFiltersValue["roleId"],
            })}
            className={selectClassName}
          >
            <option value="all">Todos los roles</option>
            {roles.map((role) => (
              <option key={role.id} value={String(role.id)}>
                {ROLE_LABELS[role.name]}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="sr-only">Estado</span>
          <select
            aria-label="Estado"
            value={value.status}
            onChange={(event) => onChange({
              ...value,
              status: event.target.value as UserFiltersValue["status"],
            })}
            className={selectClassName}
          >
            <option value="all">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>
        </label>

        <Button
          type="button"
          variant="ghost"
          disabled={!canClear}
          onClick={onClear}
          className="h-11 rounded-xl px-4 text-zinc-500"
        >
          {canClear ? <RotateCcw /> : <SlidersHorizontal />}
          Limpiar filtros
        </Button>
      </div>
    </section>
  );
};
