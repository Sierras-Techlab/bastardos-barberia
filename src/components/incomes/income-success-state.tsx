import { Check, LayoutDashboard, Plus } from "lucide-react";
import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatArs } from "@/lib/incomes/income-calculations";
import type { Income } from "@/types/income";

type IncomeSuccessStateProps = {
  income: Income;
  onReset: () => void;
};

export const IncomeSuccessState = ({
  income,
  onReset,
}: IncomeSuccessStateProps) => (
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
        El movimiento por {formatArs(income.total)} se cargó correctamente.
      </p>
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
