"use client";
import { Ban } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { IncomeListItem } from "@/types/income";
export const IncomeVoidDialog = ({ income, onClose, onConfirm }: { income: IncomeListItem; onClose(): void; onConfirm(): Promise<void> }) => {
  const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null); const pendingRef = useRef(false);
  const confirm = async () => { if (pendingRef.current) return; pendingRef.current = true; setPending(true); setError(null); try { await onConfirm(); } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo anular la venta."); } finally { pendingRef.current = false; setPending(false); } };
  return <Dialog open onOpenChange={(open) => !open && !pending && onClose()}><DialogContent className="rounded-[1.6rem] p-5 sm:max-w-md"><DialogHeader><span className="mb-1 flex size-10 items-center justify-center rounded-2xl bg-red-50 text-destructive"><Ban className="size-5" /></span><DialogTitle>Anular venta</DialogTitle><DialogDescription>Esta acción resta la visita asociada y devuelve los productos al stock. La venta seguirá visible como anulada.</DialogDescription></DialogHeader>{error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}<DialogFooter className="-mx-5 -mb-5 mt-5 p-5"><Button type="button" variant="outline" disabled={pending} onClick={onClose}>Cancelar</Button><Button type="button" variant="destructive" disabled={pending || income.status === "voided"} onClick={confirm}>{pending ? "Anulando..." : "Anular venta"}</Button></DialogFooter></DialogContent></Dialog>;
};
