"use client";

import { Filter, RotateCcw, Search } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type {
  Employee,
  IncomeKind,
  IncomeListFilters as IncomeListFiltersValue,
  PaymentMethod,
  UserRole,
} from "@/types/income";

type IncomeFiltersProps = {
  role: UserRole;
  employees: Employee[];
  value: IncomeListFiltersValue;
  onChange: (value: IncomeListFiltersValue) => void;
  onClear: () => void;
  canClear: boolean;
};

const selectClassName =
  "h-10 w-full rounded-xl border border-black/10 bg-[#f6f5f2] px-3 text-sm outline-none transition-colors focus:border-ring focus:bg-white focus:ring-2 focus:ring-ring/30";

type FilterFieldsProps = Omit<IncomeFiltersProps, "onClear" | "canClear"> & {
  idPrefix: string;
};

const FilterFields = ({
  role,
  employees,
  value,
  onChange,
  idPrefix,
}: FilterFieldsProps) => (
  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
    <label className="space-y-1 text-xs font-medium text-muted-foreground">
      Desde
      <Input
        type="date"
        aria-label="Fecha desde"
        value={value.dateFrom}
        onChange={(event) =>
          onChange({ ...value, dateFrom: event.target.value })
        }
        className="h-10 rounded-xl border-black/10 bg-[#f6f5f2] shadow-none"
      />
    </label>
    <label className="space-y-1 text-xs font-medium text-muted-foreground">
      Hasta
      <Input
        type="date"
        aria-label="Fecha hasta"
        value={value.dateTo}
        onChange={(event) =>
          onChange({ ...value, dateTo: event.target.value })
        }
        className="h-10 rounded-xl border-black/10 bg-[#f6f5f2] shadow-none"
      />
    </label>
    {role === "owner" && (
      <label className="space-y-1 text-xs font-medium text-muted-foreground">
        Empleado
        <select
          id={`${idPrefix}-employee`}
          aria-label="Empleado"
          value={value.employeeId}
          onChange={(event) =>
            onChange({ ...value, employeeId: event.target.value })
          }
          className={selectClassName}
        >
          <option value="">Todos</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.firstName} {employee.lastName}
            </option>
          ))}
        </select>
      </label>
    )}
    <label className="space-y-1 text-xs font-medium text-muted-foreground">
      Medio de pago
      <select
        id={`${idPrefix}-payment`}
        aria-label="Medio de pago"
        value={value.paymentMethod}
        onChange={(event) =>
          onChange({
            ...value,
            paymentMethod: event.target.value as PaymentMethod | "all",
          })
        }
        className={selectClassName}
      >
        <option value="all">Todos</option>
        <option value="cash">Efectivo</option>
        <option value="transfer">Transferencia</option>
      </select>
    </label>
    <label className="space-y-1 text-xs font-medium text-muted-foreground">
      Tipo de venta
      <select
        id={`${idPrefix}-kind`}
        aria-label="Tipo de venta"
        value={value.kind}
        onChange={(event) =>
          onChange({
            ...value,
            kind: event.target.value as IncomeKind | "all",
          })
        }
        className={selectClassName}
      >
        <option value="all">Todas</option>
        <option value="service">Servicio</option>
        <option value="products">Productos</option>
        <option value="combined">Combinada</option>
      </select>
    </label>
  </div>
);

export const IncomeFilters = ({
  role,
  employees,
  value,
  onChange,
  onClear,
  canClear,
}: IncomeFiltersProps) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <section aria-label="Filtros de ingresos" className="space-y-3">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground" />
          <Input
            type="search"
            aria-label="Buscar ingresos"
            placeholder="Buscar cliente, servicio o producto"
            value={value.query}
            onChange={(event) =>
              onChange({ ...value, query: event.target.value })
            }
            className="h-10 rounded-xl border-black/10 bg-white pl-10 shadow-none"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-10 rounded-xl bg-white lg:hidden"
          onClick={() => setMobileOpen(true)}
        >
          <Filter />
          Filtrar
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="hidden h-10 rounded-xl lg:inline-flex"
          disabled={!canClear}
          onClick={onClear}
        >
          <RotateCcw />
          Limpiar filtros
        </Button>
      </div>

      <div className="hidden rounded-2xl bg-white p-4 shadow-sm lg:block">
        <FilterFields
          role={role}
          employees={employees}
          value={value}
          onChange={onChange}
          idPrefix="desktop"
        />
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader className="border-b">
            <SheetTitle>Filtros de ingresos</SheetTitle>
            <SheetDescription>
              Acotá el historial por fecha, empleado, pago o tipo de venta.
            </SheetDescription>
          </SheetHeader>
          <div className="overflow-y-auto px-4">
            <FilterFields
              role={role}
              employees={employees}
              value={value}
              onChange={onChange}
              idPrefix="mobile"
            />
          </div>
          <SheetFooter className="border-t">
            <Button
              type="button"
              variant="outline"
              disabled={!canClear}
              onClick={onClear}
            >
              <RotateCcw />
              Limpiar filtros
            </Button>
            <Button type="button" onClick={() => setMobileOpen(false)}>
              Ver resultados
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </section>
  );
};
