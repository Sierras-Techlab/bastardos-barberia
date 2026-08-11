"use client";

import { UserRoundPlus } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { customerEditorSchema, validateUniqueCustomerContact } from "@/lib/customers/customer-catalog";
import type { Customer, CustomerEditorInput } from "@/types/customer";

export type CustomerEditorDialogProps = {
  mode: "create" | "edit";
  customer: Customer | null;
  customers: Customer[];
  onClose: () => void;
  onSave: (input: CustomerEditorInput) => Promise<Customer>;
};
const fieldClassName = "h-11 rounded-xl border-black/10 bg-[#f7f6f3] shadow-none focus:bg-white";

export const CustomerEditorDialog = ({ mode, customer, customers, onClose, onSave }: CustomerEditorDialogProps) => {
  const [firstName, setFirstName] = useState(customer?.firstName ?? "");
  const [lastName, setLastName] = useState(customer?.lastName ?? "");
  const [email, setEmail] = useState(customer?.email ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (savingRef.current) return;
    const parsed = customerEditorSchema.safeParse({ firstName, lastName, email, phone });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Revisá los datos ingresados."); return; }
    const duplicate = validateUniqueCustomerContact(parsed.data, customers, customer?.id);
    if (duplicate) { setError(duplicate); return; }
    savingRef.current = true; setIsSaving(true); setError(null);
    try { await onSave(parsed.data); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo guardar el cliente."); }
    finally { savingRef.current = false; setIsSaving(false); }
  };

  return <Dialog open onOpenChange={(open) => !open && !isSaving && onClose()}><DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto rounded-[1.6rem] p-5 sm:max-w-lg"><form noValidate onSubmit={submit}><DialogHeader><span className="mb-1 flex size-10 items-center justify-center rounded-2xl bg-red-50 text-primary"><UserRoundPlus className="size-5" /></span><DialogTitle>{mode === "create" ? "Nuevo cliente" : "Editar cliente"}</DialogTitle><DialogDescription>El teléfono es obligatorio y único. El email es opcional.</DialogDescription></DialogHeader><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="space-y-1.5 text-sm font-medium">Nombre<Input value={firstName} onChange={(event) => setFirstName(event.target.value)} className={fieldClassName} /></label><label className="space-y-1.5 text-sm font-medium">Apellido<Input value={lastName} onChange={(event) => setLastName(event.target.value)} className={fieldClassName} /></label><label className="space-y-1.5 text-sm font-medium sm:col-span-2">Email (opcional)<Input aria-label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={fieldClassName} /></label><label className="space-y-1.5 text-sm font-medium sm:col-span-2">Teléfono<Input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className={fieldClassName} /></label></div>{error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}<DialogFooter className="-mx-5 -mb-5 mt-5 p-5"><Button type="button" variant="outline" onClick={onClose} disabled={isSaving} className="rounded-xl">Cancelar</Button><Button type="submit" disabled={isSaving} className="rounded-xl">{isSaving ? "Guardando..." : mode === "create" ? "Crear cliente" : "Guardar cambios"}</Button></DialogFooter></form></DialogContent></Dialog>;
};
