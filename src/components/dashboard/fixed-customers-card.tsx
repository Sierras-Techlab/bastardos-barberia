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
  employee?: boolean;
  onStatusChange?: (id: string, status: Exclude<FixedOccurrenceStatus, "pending">) => void | Promise<void>;
};

const formatOccurrenceDate = (value: string) => new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "numeric", month: "short", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(`${value}T12:00:00-03:00`));
const statusCopy = {
  attended: { label: "Asistió", className: "border-emerald-700/25 bg-success text-success-foreground" },
  missed: { label: "No asistió", className: "border-red-700/25 bg-accent text-brand-foreground" },
} as const;
const currentBuenosAiresDate = (instant: Date) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit",
}).format(instant);

export const FixedCustomersCard = ({ occurrences, referenceInstant, employee = false, onStatusChange }: Props) => {
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

  const renderGroup = (title: string, entries: FixedCustomerOccurrence[]) => entries.length > 0 && (
    <div key={title} className="mt-3 first:mt-0">
      <h3 className="mb-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
      <ul className="divide-y divide-border">
        {entries.map((occurrence) => {
          const fullName = `${occurrence.customer.firstName} ${occurrence.customer.lastName}`;
          const saving = pendingId === occurrence.id;
          const status = occurrence.status === "pending" ? null : statusCopy[occurrence.status];
          return (
            <li key={occurrence.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2">
              <div className="min-w-[8rem] flex-1">
                <p className="text-xs font-semibold wrap-break-word">{fullName}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
                  <span className="first-letter:uppercase">{formatOccurrenceDate(occurrence.date)}</span> · {occurrence.time} hs
                </p>
              </div>
              {status ? (
                <span className={cn("shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold", status.className)}>
                  {status.label}
                </span>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  <Button type="button" size="sm" disabled={saving} aria-label={`Marcar asistencia de ${fullName}`} onClick={() => void changeStatus(occurrence.id, "attended")} className="min-h-11 rounded-full bg-foreground px-2.5 text-[11px] text-background hover:bg-foreground/85 lg:min-h-8">
                    <Check className="text-emerald-500" /> Asistió
                  </Button>
                  <Button type="button" variant="outline" size="sm" disabled={saving} aria-label={`Marcar ausencia de ${fullName}`} onClick={() => void changeStatus(occurrence.id, "missed")} className="min-h-11 rounded-full border-red-700/25 bg-card px-2.5 text-[11px] text-brand-foreground hover:bg-accent lg:min-h-8 dark:bg-[#1c1c24]">
                    <X /> No asistió
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <section aria-labelledby="fixed-customers-title" className="min-w-0 self-start rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-5 dark:bg-[#131318]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="fixed-customers-title" className="text-sm font-extrabold tracking-tight">Clientes fijos de la semana</h2>
          <p className="text-xs text-muted-foreground">
            {employee ? "Tus asignaciones para el resto de la semana laboral" : "Todas las asignaciones del resto de la semana laboral"}
          </p>
        </div>
        <span className="grid size-8 shrink-0 place-items-center rounded-full border border-border bg-muted text-brand-foreground dark:bg-[#191920]">
          <CalendarClock aria-hidden="true" className="size-4" />
        </span>
      </div>
      {hasOccurrences ? (
        <div aria-live="polite" className="mt-3">
          {renderGroup("Próximas", groups.upcoming)}
          {renderGroup("Sin registrar", groups.unrecorded)}
          {renderGroup("Resueltas", groups.resolved)}
        </div>
      ) : (
        <div className="mt-3 flex min-h-32 flex-col items-center justify-center rounded-2xl border border-border bg-muted px-4 py-3 text-center dark:bg-[#191920]">
          <UserRoundCheck aria-hidden="true" className="size-5 text-brand-foreground" />
          <p className="mt-1.5 text-xs font-semibold">No hay turnos fijos para el resto de la semana</p>
          <p className="mt-1 text-xs text-muted-foreground">Podés asignar un horario semanal desde el directorio.</p>
          <Link href="/customers" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-2 min-h-11 rounded-full text-xs lg:min-h-8")}>
            Gestionar clientes <ChevronRight aria-hidden="true" />
          </Link>
        </div>
      )}
      {hasOccurrences && (
        <Link href="/customers" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mt-2 min-h-11 rounded-full text-xs lg:min-h-8")}>
          Gestionar clientes fijos <ChevronRight aria-hidden="true" />
        </Link>
      )}
    </section>
  );
};
