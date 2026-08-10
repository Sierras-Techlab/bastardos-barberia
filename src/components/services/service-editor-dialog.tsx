"use client";

import { Scissors } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { serviceEditorSchema, validateUniqueServiceName } from "@/lib/services/service-catalog";
import type { ServiceCatalogItem, ServiceEditorInput } from "@/types/service-catalog";

type Props = { mode: "create" | "edit"; service: ServiceCatalogItem | null; services: ServiceCatalogItem[]; onClose: () => void; onSave: (input: ServiceEditorInput) => void };
const fieldClass = "h-11 rounded-xl border-black/10 bg-[#f7f6f3] shadow-none focus:bg-white";

export const ServiceEditorDialog = ({ mode, service, services, onClose, onSave }: Props) => {
  const [name, setName] = useState(service?.name ?? "");
  const [price, setPrice] = useState(service ? String(service.price) : "");
  const [error, setError] = useState<string | null>(null);
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = serviceEditorSchema.safeParse({ name, price: Number(price) });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Revisá los datos ingresados."); return; }
    const duplicate = validateUniqueServiceName(parsed.data.name, services, service?.id);
    if (duplicate) { setError(duplicate); return; }
    onSave(parsed.data);
  };
  return <Dialog open onOpenChange={(open) => !open && onClose()}><DialogContent className="rounded-[1.6rem] p-5 sm:max-w-lg"><form noValidate onSubmit={submit}><DialogHeader><span className="mb-1 flex size-10 items-center justify-center rounded-2xl bg-red-50 text-primary"><Scissors className="size-5" /></span><DialogTitle>{mode === "create" ? "Nuevo servicio" : "Editar servicio"}</DialogTitle><DialogDescription>Definí un nombre claro y el precio actual de venta.</DialogDescription></DialogHeader><div className="mt-5 grid gap-4"><label className="space-y-1.5 text-sm font-medium">Nombre<Input value={name} onChange={(event) => setName(event.target.value)} autoComplete="off" className={fieldClass} /></label><label className="space-y-1.5 text-sm font-medium">Precio<Input type="number" min="1" step="1" value={price} onChange={(event) => setPrice(event.target.value)} className={fieldClass} /></label></div>{error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}<DialogFooter className="-mx-5 -mb-5 mt-5 p-5"><Button type="button" variant="outline" onClick={onClose} className="rounded-xl">Cancelar</Button><Button type="submit" className="rounded-xl">{mode === "create" ? "Crear servicio" : "Guardar cambios"}</Button></DialogFooter></form></DialogContent></Dialog>;
};
