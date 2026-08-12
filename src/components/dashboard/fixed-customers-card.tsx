"use client";

import { CalendarClock, Check, ChevronRight, UserRoundCheck, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { sortFixedOccurrences, updateOccurrenceStatus } from "@/lib/customers/fixed-customers";
import { cn } from "@/lib/utils";
import type { FixedCustomerOccurrence, FixedOccurrenceStatus } from "@/types/fixed-customer";

type Props = {
  occurrences: FixedCustomerOccurrence[];
  dateFrom?: string;
  onStatusChange?: (id: string, status: FixedOccurrenceStatus) => void | Promise<void>;
};

const formatOccurrenceDate = (value: string) => new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "America/Argentina/Buenos_Aires",
}).format(new Date(`${value}T12:00:00-03:00`));

const statusCopy: Record<Exclude<FixedOccurrenceStatus, "pending">, { label: string; className: string }> = {
  attended: { label: "Asistió", className: "bg-emerald-100 text-emerald-800" },
  missed: { label: "No asistió", className: "bg-orange-100 text-orange-800" },
};

export const FixedCustomersCard = ({ occurrences, dateFrom, onStatusChange }: Props) => {
  const [currentOccurrences, setCurrentOccurrences] = useState(() => sortFixedOccurrences(
    occurrences.filter((occurrence) => !dateFrom || occurrence.date >= dateFrom),
  ));

  const changeStatus = (id: string, status: FixedOccurrenceStatus) => {
    setCurrentOccurrences((current) => updateOccurrenceStatus(current, id, status));
    void onStatusChange?.(id, status);
  };

  return <section aria-labelledby="fixed-customers-title" className="h-fit rounded-3xl border border-black/5 bg-white p-4 shadow-[0_20px_55px_-42px_rgba(0,0,0,0.4)] sm:p-5">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">Agenda semanal</p>
        <h2 id="fixed-customers-title" className="mt-1 text-lg font-semibold">Clientes fijos</h2>
        <p className="mt-1 text-sm text-muted-foreground">Próximas visitas habituales</p>
      </div>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-primary"><CalendarClock className="size-5" /></span>
    </div>

    {currentOccurrences.length > 0 ? <ul className="mt-4 space-y-2.5">
      {currentOccurrences.map((occurrence) => {
        const fullName = `${occurrence.customer.firstName} ${occurrence.customer.lastName}`;
        return <li key={occurrence.id} className="rounded-2xl border border-black/5 bg-[#f7f6f3] p-3 transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#f0efeb]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{fullName}</p>
              <p className="mt-0.5 text-xs text-muted-foreground"><span className="capitalize">{formatOccurrenceDate(occurrence.date)}</span> · {occurrence.time}</p>
            </div>
            {occurrence.status === "pending" ? <div className="flex gap-1.5">
              <Button type="button" variant="outline" size="sm" aria-label={`Marcar ausencia de ${fullName}`} onClick={() => changeStatus(occurrence.id, "missed")} className="rounded-xl bg-white"><X /> No asistió</Button>
              <Button type="button" size="sm" aria-label={`Marcar asistencia de ${fullName}`} onClick={() => changeStatus(occurrence.id, "attended")} className="rounded-xl"><Check /> Asistió</Button>
            </div> : <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusCopy[occurrence.status].className}`}>{statusCopy[occurrence.status].label}</span>}
          </div>
        </li>;
      })}
    </ul> : <div className="mt-4 flex min-h-40 flex-col items-center justify-center rounded-2xl border border-black/5 bg-[#f7f6f3] px-5 text-center">
      <UserRoundCheck className="size-7 text-primary" />
      <p className="mt-3 font-semibold">No hay clientes fijos próximos</p>
      <p className="mt-1 text-sm text-muted-foreground">Podés asignar un horario semanal desde el directorio.</p>
      <Link href="/customers" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-3 rounded-xl")}>Gestionar clientes</Link>
    </div>}

    {currentOccurrences.length > 0 && <Link href="/customers/fixed" className={cn(buttonVariants({ variant: "ghost" }), "mt-3 w-full rounded-xl")}>Ver todos los clientes fijos <ChevronRight /></Link>}
  </section>;
};
