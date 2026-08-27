import { Check, LayoutDashboard, Plus } from "lucide-react";
import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatArs } from "@/lib/incomes/income-calculations";
import type { EmployeeIncomeListItem, IncomeListItem, UserRole } from "@/types/income";

type IncomeSuccessStateProps = {
  income: IncomeListItem | EmployeeIncomeListItem;
  viewerRole: UserRole;
  onReset: () => void;
};

const isEmployeeIncome = (
  income: IncomeListItem | EmployeeIncomeListItem,
): income is EmployeeIncomeListItem =>
  Array.isArray((income as EmployeeIncomeListItem).concepts);

export const IncomeSuccessState = ({
  income,
  viewerRole,
  onReset,
}: IncomeSuccessStateProps) => {
  const total = isEmployeeIncome(income) ? income.employeeCommission : income.total;
  const amountLabel = isEmployeeIncome(income) ? "Tu comisión" : "El movimiento por";
  return (
    <Card className="mx-auto w-full max-w-xl rounded-[2rem] border-0 bg-white py-0 text-center shadow-[0_28px_80px_-45px_rgba(0,0,0,0.45)] ring-0">
      <CardContent className="flex flex-col items-center px-6 py-12 sm:px-10">
        <span className="flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <Check className="size-8" />
        </span>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Operación completada
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">
          Ingreso registrado
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          {amountLabel} {formatArs(total)} se cargó correctamente.
        </p>
        {isEmployeeIncome(income) && viewerRole === "employee" && (
          <p className="mt-2 text-xs text-muted-foreground">
            Tu comisión es el único dato financiero que recibís de este ingreso.
          </p>
        )}
        <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={onReset}
            className="h-11 rounded-xl"
          >
            <Plus />
            Cargar otro ingreso
          </Button>
          <Link
            href="/"
            className={buttonVariants({
              size: "lg",
              className: "h-11 rounded-xl",
            })}
          >
            <LayoutDashboard />
            Volver al dashboard
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};
