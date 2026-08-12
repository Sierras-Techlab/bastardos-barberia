"use client";

import { Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Customer } from "@/types/customer";

export const CustomerDeleteDialog = ({ customer, onClose, onConfirm }: { customer: Customer; onClose: () => void; onConfirm: () => Promise<void> }) => {
  const [isSaving, setIsSaving] = useState(false); const [error, setError] = useState<string | null>(null); const savingRef = useRef(false);
  const confirm = async () => { if (savingRef.current) return; savingRef.current = true; setIsSaving(true); setError(null); try { await onConfirm(); } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo eliminar el cliente."); } finally { savingRef.current = false; setIsSaving(false); } };
  return <Dialog open onOpenChange={(open) => !open && !isSaving && onClose()}><DialogContent className="rounded-[1.6rem] p-5 sm:max-w-md"><DialogHeader><span className="mb-1 flex size-10 items-center justify-center rounded-2xl bg-red-50 text-destructive"><Trash2 className="size-5" /></span><DialogTitle>Eliminar cliente</DialogTitle><DialogDescription>¿Querés eliminar a {customer.firstName} {customer.lastName}? Sus ventas conservarán la información histórica.</DialogDescription></DialogHeader>{error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}<DialogFooter className="-mx-5 -mb-5 mt-5 p-5"><Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>Cancelar</Button><Button type="button" variant="destructive" onClick={confirm} disabled={isSaving}>{isSaving ? "Eliminando..." : "Eliminar cliente"}</Button></DialogFooter></DialogContent></Dialog>;
};
