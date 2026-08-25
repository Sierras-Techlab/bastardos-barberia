"use client";

import { Loader2, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatArs } from "@/lib/incomes/income-calculations";

export type CashOpenDialogProps = {
  openingBalance: number;
  onClose(): void;
  onConfirm(input: { openingBalance: number }): Promise<void>;
};

export const CashOpenDialog = ({ openingBalance, onClose, onConfirm }: CashOpenDialogProps) => {
  const [value, setValue] = useState<string>(String(openingBalance));
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const amount = Number(value || "0");
    if (!Number.isInteger(amount) || amount < 0) {
      toast.error("Ingresá un saldo inicial válido.");
      return;
    }
    setSubmitting(true);
    try {
      await onConfirm({ openingBalance: amount });
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "No se pudo abrir la caja.");
    } finally {
      setSubmitting(false);
    }
  };

  return <Dialog open onOpenChange={(open) => !open && !submitting && onClose()}>
    <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto rounded-[1.6rem] p-5 sm:max-w-md">
      <form noValidate onSubmit={submit} className="space-y-5">
        <DialogHeader>
          <span className="mb-1 flex size-10 items-center justify-center rounded-2xl bg-red-50 text-primary"><Wallet className="size-5" /></span>
          <DialogTitle>Abrir caja del día</DialogTitle>
          <DialogDescription>El saldo inicial representa efectivo físico previo, nunca ingresos del día.</DialogDescription>
        </DialogHeader>
        <label className="block text-sm font-medium">Saldo inicial (ARS)
          <Input aria-label="Saldo inicial" type="number" inputMode="numeric" min="0" step="1" value={value} onChange={(event) => setValue(event.target.value)} className="mt-2 h-11 rounded-xl border-black/10 bg-[#f7f6f3]" />
        </label>
        <div className="rounded-2xl bg-amber-50 px-3 py-2 text-xs text-amber-900">Después de abrir vas a poder cargar el primer ingreso del día.</div>
        <DialogFooter className="-mx-5 -mb-5 flex flex-row items-center justify-end gap-2 p-5">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting} className="rounded-xl">Cancelar</Button>
          <Button type="submit" disabled={submitting} className="rounded-xl">
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Wallet className="size-4" />}
            Abrir caja ({formatArs(Number(value || "0"))})
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
};
