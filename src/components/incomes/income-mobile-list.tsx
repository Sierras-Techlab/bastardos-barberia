import { ArrowUpRight, CreditCard } from "lucide-react";

import { formatArs } from "@/lib/incomes/income-calculations";
import {
  formatIncomeConcept,
  formatIncomeDateTime,
} from "@/lib/incomes/income-list";
import type { IncomeListRow } from "@/types/income";
import { getIncomeCommissionAmount, getIncomePaymentLabel, getIncomeTotalAmount } from "@/lib/incomes/income-presentation";
import { IncomeTags } from "./income-tags";

type IncomeMobileListProps = {
  incomes: IncomeListRow[];
  onSelect: (income: IncomeListRow) => void;
};

export const IncomeMobileList = ({
  incomes,
  onSelect,
}: IncomeMobileListProps) => (
  <div className="space-y-3" aria-label="Historial de ingresos móvil">
    {incomes.map((income) => {
      const employeeName = "employee" in income && income.employee
        ? `${income.employee.firstName} ${income.employee.lastName}`
        : null;
      const total = getIncomeTotalAmount(income);
      return (
        <button
          key={income.id}
          type="button"
          aria-label={`Abrir ingreso ${income.id}`}
          onClick={() => onSelect(income)}
          className={`min-h-11 w-full rounded-[1.4rem] border border-border p-4 text-left shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${income.status === "voided" ? "bg-muted/50 opacity-60" : "bg-card hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md"}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">
                {formatIncomeDateTime(income.createdAt)}
              </p>
              <p className="mt-1 line-clamp-2 font-medium">
                {formatIncomeConcept(income)}
              </p>
              <IncomeTags income={income} className="mt-2" />
            </div>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <ArrowUpRight className="size-4" />
            </span>
          </div>

          <div className="mt-4 flex items-end justify-between gap-3 border-t border-border pt-3">
            <div className="space-y-1 text-xs text-muted-foreground">
              {employeeName ? <p>{employeeName}</p> : null}
              {income.customer ? <p>Cliente: {income.customer.firstName} {income.customer.lastName}</p> : income.customerName ? <p>Cliente: {income.customerName}</p> : null}
              <p className="flex items-center gap-1.5">
                <CreditCard className="size-3.5 text-brand-foreground" />
                {getIncomePaymentLabel(income)}
              </p>
              <p>Comisión: {formatArs(getIncomeCommissionAmount(income))}</p>
            </div>
            <div className="min-w-0 max-w-32 shrink-0 text-right">
              {total > 0 ? (
                <p
                  className={`max-w-full text-base font-semibold tabular-nums [overflow-wrap:anywhere] sm:text-lg ${
                    income.status === "voided"
                      ? "text-muted-foreground line-through"
                      : ""
                  }`}
                >
                  {formatArs(total)}
                </p>
              ) : (
                <p className="text-xs font-medium text-muted-foreground">Sólo comisión</p>
              )}
            </div>
          </div>
        </button>
      );
    })}
  </div>
);
