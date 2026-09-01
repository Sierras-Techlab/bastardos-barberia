"use client";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Expense, ExpenseRevision } from "@/types/expense";

const money = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const dateTime = (value: string) =>
  new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(value));

export const ExpenseDetailSheet = ({
  detail,
  onClose,
  onEdit,
  onVoid,
}: {
  detail: { expense: Expense; revisions: ExpenseRevision[] };
  onClose(): void;
  onEdit(): void;
  onVoid(): void;
}) => {
  const { expense, revisions } = detail;

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-lg">
        <SheetHeader className="border-b p-6">
          <SheetTitle className="break-words text-xl">{expense.concept}</SheetTitle>
          <SheetDescription className="break-words">
            {expense.categoryName} · {expense.accountingDate}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-5 p-6">
          <div className="rounded-2xl bg-[#20231f] p-5 text-white">
            <p className="text-xs text-white/60">Importe registrado</p>
            <p className="mt-1 text-3xl font-semibold">{money.format(expense.amount)}</p>
            <p className="mt-2 break-words text-sm text-white/70">
              {expense.paymentMethodName ?? "Sin medio de pago informado"}
            </p>
          </div>
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Estado</dt>
              <dd className="break-words font-medium">
                {expense.status === "active" ? "Activo" : "Anulado"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Tipo</dt>
              <dd className="break-words font-medium">{expense.categoryType}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Creado</dt>
              <dd className="break-words">{dateTime(expense.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Actualizado</dt>
              <dd className="break-words">{dateTime(expense.updatedAt)}</dd>
            </div>
          </dl>
          {expense.notes && (
            <div>
              <h3 className="font-medium">Notas</h3>
              <p className="mt-1 break-words text-sm text-muted-foreground">
                {expense.notes}
              </p>
            </div>
          )}
          {expense.voidReason && (
            <p className="break-words rounded-xl bg-red-50 p-3 text-sm text-red-700">
              Motivo de anulación: {expense.voidReason}
            </p>
          )}
          <div>
            <h3 className="font-medium">Historial de revisiones</h3>
            {revisions.length ? (
              <ol className="mt-2 space-y-2">
                {revisions.map((revision) => (
                  <li key={revision.id} className="rounded-xl border p-3 text-sm">
                    <b>Revisión {revision.revisionNumber}</b>
                    <p className="break-words text-muted-foreground">
                      {revision.reason} · {dateTime(revision.changedAt)}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                Sin ediciones registradas.
              </p>
            )}
          </div>
          {expense.status === "active" && (
            <div className="flex flex-wrap gap-2">
              <Button className="min-w-28 flex-1" onClick={onEdit}>
                Editar
              </Button>
              <Button className="min-w-28 flex-1" variant="destructive" onClick={onVoid}>
                Anular
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
