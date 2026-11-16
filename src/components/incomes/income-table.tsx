"use client";

import {
  createColumnHelper,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { ArrowUpRight } from "lucide-react";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { IncomeTags } from "./income-tags";
import { formatArs } from "@/lib/incomes/income-calculations";
import {
  formatIncomeConcept,
  formatIncomeDateTime,
} from "@/lib/incomes/income-list";
import type { IncomeListRow } from "@/types/income";
import { getIncomeCommissionAmount, getIncomePaymentLabel, getIncomeTotalAmount } from "@/lib/incomes/income-presentation";

type IncomeTableProps = {
  incomes: IncomeListRow[];
  onSelect: (income: IncomeListRow) => void;
  showEmployeeColumn?: boolean;
};

const features = tableFeatures({});

const columnHelper = createColumnHelper<typeof features, IncomeListRow>();

export const IncomeTable = ({ incomes, onSelect, showEmployeeColumn = true }: IncomeTableProps) => {
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
        header: "Concepto y tipo",
        cell: ({ row }) => (
          <div className="max-w-72">
            <p className="truncate font-medium">
              {formatIncomeConcept(row.original)}
            </p>
            <IncomeTags income={row.original} className="mt-2" />
            <p title={[
              ...(showEmployeeColumn && "employee" in row.original && row.original.employee ? [`${row.original.employee.firstName} ${row.original.employee.lastName}`] : []),
              ...(row.original.customer ? [`${row.original.customer.firstName} ${row.original.customer.lastName}`] : row.original.customerName ? [row.original.customerName] : []),
              getIncomePaymentLabel(row.original),
              `Comisión ${formatArs(getIncomeCommissionAmount(row.original))}`,
            ].join(" · ")} className="mt-1 hidden truncate text-xs text-muted-foreground xl:hidden">
              {[...(showEmployeeColumn && "employee" in row.original && row.original.employee ? [`${row.original.employee.firstName} ${row.original.employee.lastName}`] : []), ...(row.original.customer ? [`${row.original.customer.firstName} ${row.original.customer.lastName}`] : row.original.customerName ? [row.original.customerName] : []), getIncomePaymentLabel(row.original), `Comisión ${formatArs(getIncomeCommissionAmount(row.original))}`].join(" · ")}
            </p>
          </div>
        ),
        }),
        ...(showEmployeeColumn ? [columnHelper.display({
        id: "employee",
        header: "Empleado",
        cell: ({ row }) =>
          "employee" in row.original && row.original.employee
            ? `${row.original.employee.firstName} ${row.original.employee.lastName}`
            : "—",
        })] : []),
        columnHelper.display({
        id: "customer",
        header: "Cliente",
        cell: ({ row }) =>
          row.original.customer
            ? `${row.original.customer.firstName} ${row.original.customer.lastName}`
            : row.original.customerName ?? "Sin cliente",
        }),
        columnHelper.display({
        id: "payments",
        header: "Pago",
        cell: ({ row }) => getIncomePaymentLabel(row.original),
        }),
        columnHelper.display({
        id: "commission",
        header: () => <span className="block text-right">Comisión</span>,
        cell: ({ row }) => <span className="block whitespace-nowrap text-right text-xs text-muted-foreground">{formatArs(getIncomeCommissionAmount(row.original))}</span>,
        }),
        columnHelper.display({
        id: "total",
        header: () => <span className="block text-right">Total</span>,
        cell: ({ row }) => {
          const total = getIncomeTotalAmount(row.original);
          if (total === 0) {
            return <span className="block whitespace-nowrap text-right font-semibold text-muted-foreground">—</span>;
          }
          return (
            <span
              className={`block whitespace-nowrap text-right font-semibold ${
                row.original.status === "voided"
                  ? "text-muted-foreground line-through"
                  : ""
              }`}
            >
              {formatArs(total)}
            </span>
          );
        },
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
    [onSelect, showEmployeeColumn],
  );

  const table = useTable({
    features,
    data: incomes,
    columns,
  });

  const responsiveClassName = (id: string) => {
    if (id === "employee" || id === "customer" || id === "commission") return "hidden xl:table-cell";
    if (id === "payments") return "hidden lg:table-cell";
    return "";
  };

  return (
    <div className="overflow-hidden rounded-[1.6rem] bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table aria-label="Historial de ingresos" className="w-full min-w-[34rem] text-sm xl:min-w-0">
          <thead className="border-b border-border bg-accent/50 text-left text-xs tracking-wide text-muted-foreground uppercase dark:bg-accent/70">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className={`${responsiveClassName(header.column.id)} px-3 py-3 font-medium lg:px-4`}>
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
                onClick={() => onSelect(row.original)}
                className={`cursor-pointer border-b border-border transition-colors last:border-0 ${row.original.status === "voided" ? "bg-muted/40 text-muted-foreground opacity-60" : "hover:bg-accent/50"}`}
              >
                {row.getAllCells().map((cell) => (
                  <td key={cell.id} className={`${responsiveClassName(cell.column.id)} px-3 py-3.5 align-middle lg:px-4`}>
                    <table.FlexRender cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
