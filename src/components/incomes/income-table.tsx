"use client";

import {
  createColumnHelper,
  createPaginatedRowModel,
  rowPaginationFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatArs } from "@/lib/incomes/income-calculations";
import {
  formatIncomeConcept,
  formatIncomeDateTime,
} from "@/lib/incomes/income-list";
import type { IncomeListItem } from "@/types/income";
import { getIncomeCommissionState, getIncomePaymentLabel } from "@/lib/incomes/income-presentation";

type IncomeTableProps = {
  incomes: IncomeListItem[];
  onSelect: (income: IncomeListItem) => void;
};

const features = tableFeatures({
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
});

const columnHelper = createColumnHelper<typeof features, IncomeListItem>();

export const IncomeTable = ({ incomes, onSelect }: IncomeTableProps) => {
  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.display({
        id: "createdAt",
        header: "Fecha",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {formatIncomeDateTime(row.original.createdAt)}
          </span>
        ),
        }),
        columnHelper.display({
        id: "concept",
        header: "Concepto",
        cell: ({ row }) => (
          <div className="max-w-72">
            <p className="truncate font-medium">
              {formatIncomeConcept(row.original)}
            </p>
            {row.original.status === "voided" && (
              <Badge
                variant="secondary"
                className="mt-1 rounded-full bg-black/5 text-[10px] text-muted-foreground"
              >
                Anulado
              </Badge>
            )}
          </div>
        ),
        }),
        columnHelper.display({
        id: "employee",
        header: "Empleado",
        cell: ({ row }) =>
          `${row.original.employee.firstName} ${row.original.employee.lastName}`,
        }),
        columnHelper.display({
        id: "customer",
        header: "Cliente",
        cell: ({ row }) =>
          row.original.customer
            ? `${row.original.customer.firstName} ${row.original.customer.lastName}`
            : "Sin cliente",
        }),
        columnHelper.display({
        id: "paymentMethod",
        header: "Pago",
        cell: ({ row }) => getIncomePaymentLabel(row.original),
        }),
        columnHelper.display({
        id: "commission",
        header: () => <span className="block text-right">Comisión</span>,
        cell: ({ row }) => { const state = getIncomeCommissionState(row.original); return <span className="block whitespace-nowrap text-right text-xs text-muted-foreground">{state.available ? formatArs(state.amount) : "Pendiente de backend"}</span>; },
        }),
        columnHelper.display({
        id: "total",
        header: () => <span className="block text-right">Total</span>,
        cell: ({ row }) => (
          <span
            className={`block whitespace-nowrap text-right font-semibold ${
              row.original.status === "voided"
                ? "text-muted-foreground line-through"
                : ""
            }`}
          >
            {formatArs(row.original.total)}
          </span>
        ),
        }),
        columnHelper.display({
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Abrir ingreso ${row.original.id}`}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(row.original);
            }}
          >
            <ArrowUpRight />
          </Button>
        ),
        }),
      ]),
    [onSelect],
  );

  const table = useTable({
    features,
    data: incomes,
    columns,
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize: 10,
      },
    },
  });

  return (
    <div className="overflow-hidden rounded-[1.6rem] bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table aria-label="Historial de ingresos" className="w-full text-sm">
          <thead className="border-b border-black/5 bg-[#f8f7f4] text-left text-xs text-muted-foreground">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-4 py-3 font-medium">
                    {header.isPlaceholder
                      ? null
                      : <table.FlexRender header={header} />}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                aria-label={`Ingreso ${row.original.id}`}
                className="border-b border-black/5 transition-colors last:border-0 hover:bg-[#f6f5f2]"
              >
                {row.getAllCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3.5 align-middle">
                    <table.FlexRender cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-black/5 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          Página {table.state.pagination.pageIndex + 1} de{" "}
          {Math.max(table.getPageCount(), 1)}
        </p>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          >
            <ChevronLeft />
            Anterior
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
          >
            Siguiente
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
};
