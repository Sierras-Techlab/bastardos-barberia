"use client";

import { ChevronDown, Filter, RotateCcw, Search } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Employee, IncomeKind, IncomeListFilters, UserRole } from "@/types/income";
import type { PaymentMethod } from "@/types/payment-method";
import { IncomeFilterScope, incomeKindLabels } from "./income-filter-scope";

type IncomeFiltersProps = {
  role: UserRole;
  canFilterEmployees?: boolean;
  canFilterSubscriptions?: boolean;
  employees: Employee[];
  paymentMethods: PaymentMethod[];
  value: IncomeListFilters;
  onChange: (value: IncomeListFilters) => void;
  onClear: () => void;
  canClear: boolean;
};
const selectClassName = "h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30";
export const IncomeFilters = ({ role, canFilterEmployees = role !== "employee", canFilterSubscriptions = false, employees, paymentMethods, value, onChange, onClear, canClear }: IncomeFiltersProps) => {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const additionalCount = Number(Boolean(value.query)) + Number(value.paymentMethodId !== "all") + Number(value.kind !== "all");
  return (
    <section aria-label="Filtros de ingresos" className="space-y-3">
      <div className="space-y-3 rounded-2xl bg-card p-3 shadow-sm sm:p-4">
        <div className="flex items-center gap-2 md:hidden">
          <Button type="button" variant="outline" aria-label="Filtros de ingresos" aria-expanded={expanded} aria-controls={panelId} onClick={() => setExpanded(!expanded)} className="min-h-11 flex-1 justify-between rounded-xl">
            <span className="flex items-center gap-2"><Filter /> {expanded ? "Ocultar filtros" : "Filtros"}{additionalCount > 0 && <span className="rounded-full bg-primary/10 px-2 text-xs text-brand-foreground">{additionalCount}</span>}</span>
            <ChevronDown aria-hidden="true" className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </Button>
          <Button type="button" variant="ghost" disabled={!canClear} onClick={onClear} aria-label="Limpiar filtros" className="min-h-11 shrink-0 rounded-xl px-3"><RotateCcw /><span className="sr-only sm:not-sr-only">Limpiar</span></Button>
        </div>
        <div className="hidden items-end gap-3 md:grid md:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1 text-xs font-medium text-muted-foreground">Desde
            <Input type="date" aria-label="Fecha desde" value={value.dateFrom} onChange={(event) => onChange({ ...value, dateFrom: event.target.value })} className={selectClassName} />
          </label>
          <label className="space-y-1 text-xs font-medium text-muted-foreground">Hasta
            <Input type="date" aria-label="Fecha hasta" value={value.dateTo} onChange={(event) => onChange({ ...value, dateTo: event.target.value })} className={selectClassName} />
          </label>
          {canFilterEmployees && <label className="space-y-1 text-xs font-medium text-muted-foreground">Empleado
            <select aria-label="Empleado" value={value.employeeId} onChange={(event) => onChange({ ...value, employeeId: event.target.value })} className={selectClassName}>
              <option value="">Todos los empleados</option>
              {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName}</option>)}
            </select>
          </label>}
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <Button type="button" variant="outline" aria-label="Más filtros" aria-expanded={expanded} aria-controls={panelId} onClick={() => setExpanded(!expanded)} className="min-h-11 rounded-xl">
            <Filter /> {expanded ? "Ocultar filtros" : "Más filtros"}{additionalCount > 0 && <span className="rounded-full bg-primary/10 px-2 text-xs text-brand-foreground">{additionalCount}</span>}
          </Button>
          <Button type="button" variant="ghost" disabled={!canClear} onClick={onClear} className="min-h-11 rounded-xl"><RotateCcw /> Limpiar filtros</Button>
        </div>
        <div id={panelId} className={`${expanded ? "grid" : "hidden"} gap-3 border-t border-border pt-4 md:grid-cols-2 lg:grid-cols-3`}>
          <div className="grid gap-3 md:hidden">
            <label className="space-y-1 text-xs font-medium text-muted-foreground">Desde
              <Input type="date" aria-label="Fecha desde" value={value.dateFrom} onChange={(event) => onChange({ ...value, dateFrom: event.target.value })} className={selectClassName} />
            </label>
            <label className="space-y-1 text-xs font-medium text-muted-foreground">Hasta
              <Input type="date" aria-label="Fecha hasta" value={value.dateTo} onChange={(event) => onChange({ ...value, dateTo: event.target.value })} className={selectClassName} />
            </label>
            {canFilterEmployees && <label className="space-y-1 text-xs font-medium text-muted-foreground">Empleado
              <select aria-label="Empleado" value={value.employeeId} onChange={(event) => onChange({ ...value, employeeId: event.target.value })} className={selectClassName}>
                <option value="">Todos los empleados</option>
                {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName}</option>)}
              </select>
            </label>}
          </div>
          <div className="grid gap-3 border-t border-border pt-4 md:col-span-2 md:grid-cols-2 md:border-0 md:pt-0 lg:col-span-3 lg:grid-cols-3">
            <label className="space-y-1 text-xs font-medium text-muted-foreground">Buscar
              <div className="relative">
                <Search className="pointer-events-none absolute top-3.5 left-3 size-4" />
                <Input type="search" aria-label="Buscar ingresos" placeholder="Cliente, empleado, servicio o producto" value={value.query} onChange={(event) => onChange({ ...value, query: event.target.value })} className={`${selectClassName} pl-10`} />
              </div>
            </label>
            <label className="space-y-1 text-xs font-medium text-muted-foreground">Medio de pago
              <select aria-label="Medio de pago" value={value.paymentMethodId} onChange={(event) => onChange({ ...value, paymentMethodId: event.target.value })} className={selectClassName}>
                <option value="all">Todos los medios</option>
                {paymentMethods.map((method) => <option key={method.id} value={method.id}>{method.name}{method.isActive ? "" : " (inactivo)"}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs font-medium text-muted-foreground">Qué querés ver
              <select aria-label="Qué querés ver" value={value.kind} onChange={(event) => onChange({ ...value, kind: event.target.value as IncomeKind | "all" })} className={selectClassName}>
                {Object.entries(incomeKindLabels).filter(([kind]) => (role !== "employee" || (kind !== "chair_rental" && kind !== "subscription")) && (canFilterSubscriptions || kind !== "subscription")).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}
              </select>
            </label>
          </div>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">Los tipos seleccionan operaciones completas. Servicio + productos tiene su propia opción.</p>
        </div>
      </div>
      <div className="md:hidden"><IncomeFilterScope compact role={role} value={value} employees={employees} paymentMethods={paymentMethods} onChange={onChange} /></div>
      <div className="hidden md:block"><IncomeFilterScope role={role} value={value} employees={employees} paymentMethods={paymentMethods} onChange={onChange} /></div>
    </section>
  );
};
