"use client";

import { CalendarClock, Check, ChevronRight, UserRoundCheck, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { sortFixedOccurrences } from "@/lib/customers/fixed-customers";
import { fixedCustomerClient } from "@/lib/fixed-customers/client";
import { cn } from "@/lib/utils";
import type { FixedCustomerOccurrence, FixedOccurrenceStatus } from "@/types/fixed-customer";

type Props = {
  occurrences: FixedCustomerOccurrence[];
  dateFrom?: string;
  onStatusChange?: (id: string, status: Exclude<FixedOccurrenceStatus, "pending">) => void | Promise<void>;
};
const formatOccurrenceDate = (value: string) => new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(`${value}T12:00:00-03:00`));
const statusCopy = {
  attended: { label: "Asistió", className: "bg-emerald-100 text-emerald-800" },
  missed: { label: "No asistió", className: "bg-orange-100 text-orange-800" },
} as const;

export const FixedCustomersCard = ({ occurrences, dateFrom, onStatusChange }: Props) => {
  const [currentOccurrences, setCurrentOccurrences] = useState(() => sortFixedOccurrences(occurrences.filter((occurrence) => !dateFrom || occurrence.date >= dateFrom)));
  const [pendingId, setPendingId] = useState<string | null>(null);

  const changeStatus = async (id: string, status: "attended" | "missed") => {
    if (pendingId) return;
    setPendingId(id);
    try {
      if (onStatusChange) {
        await onStatusChange(id, status);
        setCurrentOccurrences((current) => current.map((occurrence) => occurrence.id === id ? { ...occurrence, status } : occurrence));
      } else {
        const saved = await fixedCustomerClient.resolve(id, { status, expectedStatus: "pending" });
        setCurrentOccurrences((current) => current.map((occurrence) => occurrence.id === id ? saved : occurrence));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo registrar la asistencia.");
    } finally {
      setPendingId(null);
    }
  };

  return <section aria-labelledby="fixed-customers-title" className="h-fit rounded-3xl border border-black/5 bg-white p-4 shadow-[0_20px_55px_-42px_rgba(0,0,0,0.4)] sm:p-5">
    <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">Agenda semanal</p><h2 id="fixed-customers-title" className="mt-1 text-lg font-semibold">Clientes fijos</h2><p className="mt-1 text-sm text-muted-foreground">Próximas visitas habituales</p></div><span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-primary"><CalendarClock className="size-5" /></span></div>
    {currentOccurrences.length > 0 ? <ul className="mt-4 space-y-2.5">{currentOccurrences.map((occurrence) => {
      const fullName = `${occurrence.customer.firstName} ${occurrence.customer.lastName}`;
      const saving = pendingId === occurrence.id;
      return <li key={occurrence.id} className="rounded-2xl border border-black/5 bg-[#f7f6f3] p-3"><div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{fullName}</p><p className="mt-0.5 text-xs text-muted-foreground"><span className="capitalize">{formatOccurrenceDate(occurrence.date)}</span> · {occurrence.time}</p></div>{occurrence.status === "pending" ? <div className="flex gap-1.5"><Button type="button" variant="outline" size="sm" disabled={saving} aria-label={`Marcar ausencia de ${fullName}`} onClick={() => void changeStatus(occurrence.id, "missed")} className="rounded-xl bg-white"><X /> No asistió</Button><Button type="button" size="sm" disabled={saving} aria-label={`Marcar asistencia de ${fullName}`} onClick={() => void changeStatus(occurrence.id, "attended")} className="rounded-xl"><Check /> Asistió</Button></div> : <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusCopy[occurrence.status].className}`}>{statusCopy[occurrence.status].label}</span>}</div></li>;
    })}</ul> : <div className="mt-4 flex min-h-40 flex-col items-center justify-center rounded-2xl border border-black/5 bg-[#f7f6f3] px-5 text-center"><UserRoundCheck className="size-7 text-primary" /><p className="mt-3 font-semibold">No hay clientes fijos próximos</p><p className="mt-1 text-sm text-muted-foreground">Podés asignar un horario semanal desde el directorio.</p><Link href="/customers" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-3 rounded-xl")}>Gestionar clientes</Link></div>}
    {currentOccurrences.length > 0 && <Link href="/customers" className={cn(buttonVariants({ variant: "ghost" }), "mt-3 w-full rounded-xl")}>Gestionar clientes fijos <ChevronRight /></Link>}
  </section>;
};
