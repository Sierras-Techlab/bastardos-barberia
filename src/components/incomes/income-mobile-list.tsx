import { ArrowUpRight, CreditCard } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatArs } from "@/lib/incomes/income-calculations";
import {
  formatIncomeConcept,
  formatIncomeDateTime,
} from "@/lib/incomes/income-list";
import type { IncomeListItem } from "@/types/income";
import { getIncomeCommissionAmount, getIncomePaymentLabel } from "@/lib/incomes/income-presentation";

type IncomeMobileListProps = {
  incomes: IncomeListItem[];
  onSelect: (income: IncomeListItem) => void;
};

export const IncomeMobileList = ({
  incomes,
  onSelect,
}: IncomeMobileListProps) => (
  <div className="space-y-3" aria-label="Historial de ingresos móvil">
    {incomes.map((income) => (
        <button
          key={income.id}
          type="button"
          aria-label={`Abrir ingreso ${income.id}`}
          onClick={() => onSelect(income)}
          className="w-full rounded-[1.4rem] bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">
                {formatIncomeDateTime(income.createdAt)}
              </p>
              <p className="mt-1 line-clamp-2 font-medium">
                {formatIncomeConcept(income)}
              </p>
            </div>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#f6f5f2] text-primary">
              <ArrowUpRight className="size-4" />
            </span>
          </div>

          <div className="mt-4 flex items-end justify-between gap-3 border-t border-black/5 pt-3">
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>
                {income.employee.firstName} {income.employee.lastName}
              </p>
              <p className="flex items-center gap-1.5">
                <CreditCard className="size-3.5" />
                {getIncomePaymentLabel(income)}
              </p>
              <p>Comisión: {formatArs(getIncomeCommissionAmount(income))}</p>
            </div>
            <div className="text-right">
              {income.status === "voided" && (
                <Badge
                  variant="secondary"
                  className="mb-1 rounded-full bg-black/5 text-[10px] text-muted-foreground"
                >
                  Anulado
                </Badge>
              )}
              <p
                className={`text-lg font-semibold ${
                  income.status === "voided"
                    ? "text-muted-foreground line-through"
                    : ""
                }`}
              >
                {formatArs(income.total)}
              </p>
            </div>
          </div>
        </button>
    ))}
  </div>
);
