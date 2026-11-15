"use client";

import { CalendarClock, Check, ChevronRight, UserRoundCheck, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { groupFixedOccurrencesByTime } from "@/lib/dashboard/fixed-occurrence-groups";
import { sortFixedOccurrences } from "@/lib/customers/fixed-customers";
import { fixedCustomerClient } from "@/lib/fixed-customers/client";
import { cn } from "@/lib/utils";
import type { FixedCustomerOccurrence, FixedOccurrenceStatus } from "@/types/fixed-customer";

type Props = {
  occurrences: FixedCustomerOccurrence[];
  referenceInstant?: string;
  onStatusChange?: (id: string, status: Exclude<FixedOccurrenceStatus, "pending">) => void | Promise<void>;
};

const formatOccurrenceDate = (value: string) => new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(`${value}T12:00:00-03:00`));
const statusCopy = {
  attended: { label: "Asistió", className: "bg-success/10 text-success-foreground" },
  missed: { label: "No asistió", className: "bg-warning/10 text-warning-foreground" },
} as const;
const currentBuenosAiresDate = (instant: Date) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit",
}).format(instant);

export const FixedCustomersCard = ({ occurrences, referenceInstant, onStatusChange }: Props) => {
  const { refresh } = useRouter();
  const serverReference = referenceInstant ? new Date(referenceInstant) : new Date();
  const serverDay = currentBuenosAiresDate(serverReference);
  const [clockNow, setClockNow] = useState(serverReference);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, "attended" | "missed">>({});
  const now = clockNow > serverReference ? clockNow : serverReference;
  const lastRequestedDay = useRef(currentBuenosAiresDate(serverReference));
  const [pendingId, setPendingId] = useState<string | null>(null);
  const currentOccurrences = useMemo(() => sortFixedOccurrences(occurrences.map((occurrence) => ({
    ...occurrence,
    status: statusOverrides[occurrence.id] ?? occurrence.status,
  }))), [occurrences, statusOverrides]);
  const groups = useMemo(() => groupFixedOccurrencesByTime(currentOccurrences, now), [currentOccurrences, now]);
  const hasOccurrences = groups.upcoming.length + groups.unrecorded.length + groups.resolved.length > 0;

  const refreshForCurrentDay = useCallback((day: string) => {
    if (lastRequestedDay.current === day) return;
    lastRequestedDay.current = day;
    refresh();
  }, [refresh]);

  const updateClock = useCallback(() => {
    const next = new Date();
    const day = currentBuenosAiresDate(next);
    setClockNow(next);
    if (serverDay === day) lastRequestedDay.current = day;
    else refreshForCurrentDay(day);
  }, [serverDay, refreshForCurrentDay]);

  useEffect(() => {
    const mountSync = window.setTimeout(updateClock, 0);
    let interval: number | undefined;
    const firstMinute = 60_000 - (Date.now() % 60_000) + 25;
    const firstTick = window.setTimeout(() => {
      updateClock();
      interval = window.setInterval(updateClock, 60_000);
    }, firstMinute);
    window.addEventListener("focus", updateClock);
    document.addEventListener("visibilitychange", updateClock);
    return () => {
      window.clearTimeout(mountSync);
      window.clearTimeout(firstTick);
      if (interval !== undefined) window.clearInterval(interval);
      window.removeEventListener("focus", updateClock);
      document.removeEventListener("visibilitychange", updateClock);
    };
  }, [updateClock]);

  const changeStatus = async (id: string, status: "attended" | "missed") => {
    if (pendingId) return;
    setPendingId(id);
    try {
      if (onStatusChange) {
        await onStatusChange(id, status);
        setStatusOverrides((current) => ({ ...current, [id]: status }));
      } else {
        const saved = await fixedCustomerClient.resolve(id, { status, expectedStatus: "pending" });
        const savedStatus = saved.status;
        if (savedStatus !== "pending") {
          setStatusOverrides((current) => ({ ...current, [id]: savedStatus }));
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo registrar la asistencia.");
    } finally {
      setPendingId(null);
    }
  };

  const renderGroup = (title: string, entries: FixedCustomerOccurrence[], terminal = false) => entries.length > 0 && (
    <div key={title} className="mt-4 first:mt-0">
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
      <ul className="space-y-2.5">
        {entries.map((occurrence) => {
          const fullName = `${occurrence.customer.firstName} ${occurrence.customer.lastName}`;
          const saving = pendingId === occurrence.id;
          return <li key={occurrence.id} className="rounded-2xl border border-border/70 bg-muted/70 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0"><p className="truncate text-sm font-semibold">{fullName}</p><p className="mt-0.5 text-xs text-muted-foreground"><span className="capitalize">{formatOccurrenceDate(occurrence.date)}</span> · {occurrence.time}</p></div>
              {terminal
                ? <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusCopy[occurrence.status as "attended" | "missed"].className}`}>{statusCopy[occurrence.status as "attended" | "missed"].label}</span>
                : <div className="flex flex-wrap gap-1.5"><Button type="button" variant="outline" size="sm" disabled={saving} aria-label={`Marcar ausencia de ${fullName}`} onClick={() => void changeStatus(occurrence.id, "missed")} className="min-h-11 rounded-xl"> <X /> No asistió</Button><Button type="button" size="sm" disabled={saving} aria-label={`Marcar asistencia de ${fullName}`} onClick={() => void changeStatus(occurrence.id, "attended")} className="min-h-11 rounded-xl"><Check /> Asistió</Button></div>}
            </div>
          </li>;
        })}
      </ul>
    </div>
  );

  return <section aria-labelledby="fixed-customers-title" className="h-fit rounded-3xl border border-border bg-card p-4 shadow-[0_20px_55px_-42px_rgba(0,0,0,0.4)] sm:p-5">
    <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold tracking-[0.16em] text-brand-foreground uppercase">Agenda semanal</p><h2 id="fixed-customers-title" className="mt-1 text-lg font-semibold">Clientes fijos</h2><p className="mt-1 text-sm text-muted-foreground">Visitas habituales de hoy al sábado</p></div><span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-brand-foreground"><CalendarClock className="size-5" /></span></div>
    {hasOccurrences ? <div aria-live="polite" className="mt-4">
      {renderGroup("Próximas", groups.upcoming)}
      {renderGroup("Sin registrar", groups.unrecorded)}
      {renderGroup("Resueltas", groups.resolved, true)}
    </div> : <div className="mt-4 flex min-h-40 flex-col items-center justify-center rounded-2xl border border-border bg-muted px-5 text-center"><UserRoundCheck className="size-7 text-brand-foreground" /><p className="mt-3 font-semibold">No hay turnos fijos para el resto de la semana</p><p className="mt-1 text-sm text-muted-foreground">Podés asignar un horario semanal desde el directorio.</p><Link href="/customers" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-3 min-h-11 rounded-xl")}>Gestionar clientes</Link></div>}
    {hasOccurrences && <Link href="/customers" className={cn(buttonVariants({ variant: "ghost" }), "mt-3 min-h-11 w-full rounded-xl")}>Gestionar clientes fijos <ChevronRight /></Link>}
  </section>;
};
