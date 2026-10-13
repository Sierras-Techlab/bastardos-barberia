"use client";

import { LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatBuenosAiresDateTime, formatChairRentalPeriod } from "@/lib/chair-rentals/presentation";
import type { ChairRentalPayment } from "@/types/chair-rental";

const money = (amount: number) => new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
}).format(amount);

const labels = {
  pending: "Pendiente",
  paid: "Pagado",
  overdue: "Vencido",
  voided: "Anulado",
} as const;

type Props = {
  employeeName: string;
  items: ChairRentalPayment[];
  open: boolean;
  loading?: boolean;
  error?: string | null;
  owner: boolean;
  onClose: () => void;
  onVoid: (item: ChairRentalPayment) => void;
};

export const ChairRentalHistorySheet = ({
  employeeName,
  items,
  open,
  loading,
  error,
  owner,
  onClose,
  onVoid,
}: Props) => (
  <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
    <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-lg">
      <SheetHeader className="border-b border-black/5 p-5">
        <SheetTitle>Alquiler de silla</SheetTitle>
        <SheetDescription>Historial de {employeeName}</SheetDescription>
      </SheetHeader>
      <div className="space-y-3 p-5">
        {loading && (
          <p className="flex items-center gap-2 text-sm text-zinc-500" role="status">
            <LoaderCircle className="animate-spin" />
            Cargando historial…
          </p>
        )}
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {!loading && !error && items.length === 0 && <p className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-500">No hay intentos registrados.</p>}
        {items.map((item) => (
          <article key={item.id} className="rounded-2xl border border-black/5 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">
                  <span className="text-zinc-500">Período facturado: </span>
                  {formatChairRentalPeriod(item.period)}
                </p>
                <p className="text-sm text-zinc-500">
                  {labels[item.status]}
                  {item.paymentMethodName ? ` · ${item.paymentMethodName}` : ""}
                  {` · ${money(item.amount)}`}
                </p>
              </div>
              {owner && item.status === "paid" && (
                <Button variant="outline" size="sm" onClick={() => onVoid(item)} className="rounded-lg">
                  Anular
                </Button>
              )}
            </div>
            {item.paidAt && <p className="mt-2 text-xs text-zinc-500">Fecha de cobro: {formatBuenosAiresDateTime(item.paidAt)}</p>}
            {item.confirmedBy && <p className="text-xs text-zinc-500">Confirmó: {item.confirmedBy.firstName} {item.confirmedBy.lastName}</p>}
            {item.voidedAt && <p className="mt-2 text-xs text-red-700">Fecha de anulación: {formatBuenosAiresDateTime(item.voidedAt)}</p>}
            {item.voidReason && (
              <p className="mt-2 border-t border-black/5 pt-2 text-xs text-red-700">
                Motivo de anulación: {item.voidReason}
                {item.voidedBy ? ` · Anuló: ${item.voidedBy.firstName} ${item.voidedBy.lastName}` : ""}
              </p>
            )}
          </article>
        ))}
      </div>
    </SheetContent>
  </Sheet>
);
