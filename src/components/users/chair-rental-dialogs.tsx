"use client";

import { LoaderCircle } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatChairRentalPeriod } from "@/lib/chair-rentals/presentation";
import type { PaymentMethod } from "@/types/payment-method";
import type { ChairRentalPayment } from "@/types/chair-rental";

const money = (amount: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(amount);
type ConfirmProps = { payment: ChairRentalPayment | null; methods: PaymentMethod[]; open: boolean; pending?: boolean; methodsLoading?: boolean; methodsError?: string | null; onRetryMethods?: () => void; error?: string | null; onClose: () => void; onConfirm: (methodId: string) => Promise<void> };
export const ChairRentalConfirmDialog = ({ payment, methods, open, pending = false, methodsLoading = false, methodsError, onRetryMethods, error, onClose, onConfirm }: ConfirmProps) => {
  const [methodId, setMethodId] = useState("");
  const submitting = useRef(false);
  const activeMethods = methods.filter((method) => method.isActive);
  const selectedMethodId = activeMethods.some((method) => method.id === methodId) ? methodId : activeMethods[0]?.id || "";
  const confirm = async () => { if (!selectedMethodId || pending || submitting.current) return; submitting.current = true; try { await onConfirm(selectedMethodId); } finally { submitting.current = false; } };
  return (
    <Dialog open={open} onOpenChange={(next) => !next && !pending && onClose()}>
      <DialogContent className="rounded-[1.6rem] p-5">
        <DialogHeader>
          <DialogTitle>Registrar pago de alquiler</DialogTitle>
          <DialogDescription>
            {payment?.employeeName} · período facturado: {formatChairRentalPeriod(payment?.period ?? "")}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 text-sm">
          <p>
            <span className="text-zinc-500">Importe a registrar:</span>{" "}
            <strong>{payment && money(payment.amount)}</strong>
          </p>
          <p className="rounded-xl bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-600">
            La fecha de cobro se asigna automáticamente según la hora de Buenos Aires.
          </p>
          {methodsLoading ? <p role="status" className="rounded-xl bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-600">Cargando medios de pago…</p> : methodsError ? <div className="space-y-2"><p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">{methodsError}</p>{onRetryMethods && <Button type="button" variant="outline" onClick={onRetryMethods} disabled={pending} className="rounded-xl">Reintentar medios de pago</Button>}</div> : activeMethods.length === 0 ? <p role="alert" className="rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">No hay medios de pago activos configurados.</p> : <label>
            Medio de pago
            <select aria-label="Medio de pago" required value={selectedMethodId} onChange={(e) => setMethodId(e.target.value)} disabled={pending} className="mt-1 h-11 w-full rounded-xl border border-black/10 bg-[#f7f6f3] px-3">
              <option value="">Elegí un medio</option>
              {activeMethods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}
            </select>
          </label>}
        </div>
        {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={onClose} className="rounded-xl">Cancelar</Button>
          <Button disabled={!selectedMethodId || pending || methodsLoading || Boolean(methodsError) || activeMethods.length === 0} onClick={confirm} className="rounded-xl">{pending && <LoaderCircle className="animate-spin" />}Confirmar pago</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

type VoidProps = { payment: ChairRentalPayment | null; open: boolean; pending?: boolean; error?: string | null; onClose: () => void; onVoid: (reason: string) => Promise<void> };
export const ChairRentalVoidDialog = ({ payment, open, pending = false, error, onClose, onVoid }: VoidProps) => {
  const [reason, setReason] = useState("");
  const submitting = useRef(false);
  const trimmedReason = reason.trim();
  const voidPayment = async () => {
    if (!trimmedReason || trimmedReason.length > 500 || pending || submitting.current) return;
    submitting.current = true;
    try {
      await onVoid(trimmedReason);
    } finally {
      submitting.current = false;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !pending && onClose()}>
      <DialogContent className="rounded-[1.6rem] p-5">
        <DialogHeader>
          <DialogTitle>Anular pago de alquiler</DialogTitle>
          <DialogDescription>Se conserva el registro original y se revierte su efecto financiero.</DialogDescription>
        </DialogHeader>
        <p className="text-sm">
          {payment?.employeeName} · período facturado: {formatChairRentalPeriod(payment?.period ?? "")} · {payment && money(payment.amount)}
        </p>
        <label className="text-sm">
          Motivo
          <textarea aria-label="Motivo de anulación" required minLength={1} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} disabled={pending} className="mt-1 min-h-24 w-full rounded-xl border border-black/10 bg-[#f7f6f3] p-3" />
        </label>
        {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={onClose} className="rounded-xl">Cancelar</Button>
          <Button variant="destructive" disabled={!trimmedReason || trimmedReason.length > 500 || pending} onClick={voidPayment} className="rounded-xl">{pending && <LoaderCircle className="animate-spin" />}Anular pago</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
