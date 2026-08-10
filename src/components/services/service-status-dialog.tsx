"use client";

import { Power } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ServiceCatalogItem } from "@/types/service-catalog";

export const ServiceStatusDialog = ({ service, onClose, onConfirm }: { service: ServiceCatalogItem; onClose: () => void; onConfirm: () => void }) => {
  const action = service.isActive ? "Desactivar" : "Activar";
  return <Dialog open onOpenChange={(open) => !open && onClose()}><DialogContent className="rounded-[1.6rem] p-5 sm:max-w-md"><DialogHeader><span className="mb-1 flex size-10 items-center justify-center rounded-2xl bg-red-50 text-primary"><Power className="size-5" /></span><DialogTitle>{action} servicio</DialogTitle><DialogDescription>{service.isActive ? `${service.name} dejará de estar disponible para empleados, pero conservará su información.` : `${service.name} volverá a estar disponible para empleados.`}</DialogDescription></DialogHeader><DialogFooter className="-mx-5 -mb-5 mt-5 p-5"><Button type="button" variant="outline" onClick={onClose} className="rounded-xl">Cancelar</Button><Button type="button" onClick={onConfirm} className="rounded-xl">{action} servicio</Button></DialogFooter></DialogContent></Dialog>;
};
