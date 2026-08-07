"use client";

import { ReceiptText, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { IncomeDetailSheet } from "@/components/incomes/income-detail-sheet";
import { IncomeFilters } from "@/components/incomes/income-filters";
import { IncomeMetrics } from "@/components/incomes/income-metrics";
import { IncomeMobileList } from "@/components/incomes/income-mobile-list";
import { IncomeTable } from "@/components/incomes/income-table";
import {
  calculateIncomeMetrics,
  filterIncomeItems,
  sortIncomeItems,
} from "@/lib/incomes/income-list";
import type {
  IncomeListData,
  IncomeListFilters,
  IncomeListItem,
} from "@/types/income";

type IncomesViewProps = {
  data: IncomeListData;
};

const initialFilters: IncomeListFilters = {
  query: "",
  dateFrom: "2026-08-01",
  dateTo: "2026-08-31",
  employeeId: "",
  paymentMethod: "all",
  kind: "all",
};

export const IncomesView = ({ data }: IncomesViewProps) => {
  const [filters, setFilters] = useState(initialFilters);
  const [selectedIncome, setSelectedIncome] = useState<IncomeListItem | null>(
    null,
  );

  const allowedIncomes = useMemo(
    () =>
      data.currentUser.role === "owner"
        ? data.incomes
        : data.incomes.filter(
            (income) => income.employee.id === data.currentUser.id,
          ),
    [data],
  );

  const incomes = useMemo(
    () => sortIncomeItems(filterIncomeItems(allowedIncomes, filters)),
    [allowedIncomes, filters],
  );
  const metrics = useMemo(() => calculateIncomeMetrics(incomes), [incomes]);
  const canClear = JSON.stringify(filters) !== JSON.stringify(initialFilters);
  const movementLabel = `${incomes.length} ${
    incomes.length === 1 ? "movimiento" : "movimientos"
  }`;

  const clearFilters = () => setFilters(initialFilters);

  return (
    <div className="space-y-5">
      <IncomeMetrics metrics={metrics} />

      <IncomeFilters
        role={data.currentUser.role}
        employees={data.employees}
        value={filters}
        onChange={setFilters}
        onClear={clearFilters}
        canClear={canClear}
      />

      <section aria-labelledby="income-history-title">
        <div className="mb-3 flex items-end justify-between gap-4 px-1">
          <div>
            <h2 id="income-history-title" className="text-lg font-semibold">
              Historial de ventas
            </h2>
            <p className="text-sm text-muted-foreground">{movementLabel}</p>
          </div>
          <p className="hidden text-xs text-muted-foreground sm:block">
            Los anulados no se suman al resumen
          </p>
        </div>

        {incomes.length > 0 ? (
          <>
            <div className="hidden md:block">
              <IncomeTable incomes={incomes} onSelect={setSelectedIncome} />
            </div>
            <div className="md:hidden">
              <IncomeMobileList
                incomes={incomes}
                onSelect={setSelectedIncome}
              />
            </div>
          </>
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-[1.6rem] bg-white px-6 text-center shadow-sm">
            <span className="flex size-12 items-center justify-center rounded-full bg-[#f6f5f2] text-primary">
              <ReceiptText className="size-5" />
            </span>
            <h3 className="mt-4 font-semibold">No encontramos ingresos</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Probá cambiando la búsqueda o limpiando los filtros aplicados.
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-4 rounded-xl"
              onClick={clearFilters}
            >
              <RotateCcw />
              Limpiar filtros
            </Button>
          </div>
        )}
      </section>

      <IncomeDetailSheet
        income={selectedIncome}
        open={selectedIncome !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedIncome(null);
        }}
      />
    </div>
  );
};
