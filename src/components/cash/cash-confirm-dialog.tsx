"use client";

import { CircleCheck, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatArs } from "@/lib/incomes/income-calculations";

export type CashConfirmDialogProps = {
  expectedCash: number;
  onClose(): void;
  onConfirm(input: { countedCash: number }): Promise<void>;
};

export const CashConfirmDialog = ({ expectedCash, onClose, onConfirm }: CashConfirmDialogProps) => {
  const [value, setValue] = useState<string>(String(expectedCash / 100));
  const [submitting, setSubmitting] = useState(false);

  const counted = Math.round(Number(value || "0") * 100);
  const difference = counted - expectedCash;

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    if (Number.isNaN(counted) || counted < 0) {
      toast.error("Ingresá un conteo válido.");
      return;
    }
    setSubmitting(true);
    try {
      await onConfirm({ countedCash: counted });
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "No se pudo confirmar la caja.");
    } finally {
      setSubmitting(false);
    }
  };

  return <Dialog open onOpenChange={(open) => !open && !submitting && onClose()}>
    <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto rounded-[1.6rem] p-5 sm:max-w-md">
      <form noValidate onSubmit={submit} className="space-y-5">
        <DialogHeader>
          <span className="mb-1 flex size-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><ShieldCheck className="size-5" /></span>
          <DialogTitle>Confirmar conteo pendiente</DialogTitle>
          <DialogDescription>Una vez confirmado, los totales financieros y el conteo físico quedan inmutables.</DialogDescription>
        </DialogHeader>
        <div className="rounded-2xl border border-black/8 bg-[#f7f6f3] p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Efectivo esperado</p>
          <p className="mt-1 text-2xl font-semibold">{formatArs(expectedCash)}</p>
        </div>
        <label className="block text-sm font-medium">Conteo físico final (ARS)
          <Input aria-label="Conteo físico final" type="number" inputMode="decimal" min="0" step="0.01" value={value} onChange={(event) => setValue(event.target.value)} className="mt-2 h-11 rounded-xl border-black/10 bg-[#f7f6f3]" />
        </label>
        <div className={`rounded-xl px-3 py-2 text-sm ${difference === 0 ? "bg-emerald-50 text-emerald-800" : difference > 0 ? "bg-blue-50 text-blue-800" : "bg-red-50 text-red-700"}`}>
          {difference === 0 ? "Sin diferencia" : difference > 0 ? `Sobran ${formatArs(difference)}` : `Faltan ${formatArs(Math.abs(difference))}`}
        </div>
        <DialogFooter className="-mx-5 -mb-5 flex flex-row items-center justify-end gap-2 p-5">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting} className="rounded-xl">Cancelar</Button>
          <Button type="submit" disabled={submitting} className="rounded-xl">
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <CircleCheck className="size-4" />}
            Confirmar
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
};