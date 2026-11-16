"use client";

import { BarChart3 } from "lucide-react";
import { useState } from "react";

import type { DashboardIncomeDay } from "@/lib/dashboard/income-summary";
import { cn } from "@/lib/utils";

const currency = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const localDay = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

function dayName(day: DashboardIncomeDay) {
  return localDay.format(new Date(day.date + "T12:00:00Z"));
}

export function SevenDayEvolution({ series, employee }: { series: DashboardIncomeDay[]; employee: boolean }) {
  const [selection, setSelection] = useState<string | null>(null);
  const selected = series.find((day) => day.date === selection);
  const hasActivity = series.some((day) => day.total > 0 || day.count > 0);
  const max = Math.max(1, ...series.map((day) => day.total));

  return (
    <section aria-labelledby="seven-day-title" className="min-w-0 self-start rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-5 dark:bg-[#131318]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="seven-day-title" className="text-sm font-extrabold tracking-tight">Últimos 7 días</h2>
          <p className="text-xs text-muted-foreground">
            {employee ? "Evolución de tus comisiones de los últimos 7 días" : "Evolución de ingresos de los últimos 7 días"}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground dark:bg-[#191920]">7 días</span>
      </div>

      {hasActivity ? (
        <>
          <div className="mt-4 grid h-38 grid-cols-7 gap-0.5 sm:gap-2">
            {series.map((day, index) => {
              const isToday = index === series.length - 1;
              const height = day.total === 0 ? 0 : Math.max(12, day.total / max * 100);
              return (
                <button
                  key={day.date}
                  type="button"
                  aria-label={dayName(day) + ", " + currency.format(day.total)}
                  aria-pressed={selected?.date === day.date}
                  onClick={() => setSelection(selected?.date === day.date ? null : day.date)}
                  className="grid min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] items-end gap-1 rounded-md pt-2 text-center outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span aria-hidden="true" className={cn("text-[9px] whitespace-nowrap tabular-nums sm:text-[11px]", isToday ? "font-bold text-brand-foreground" : "text-muted-foreground")}>
                    {"$" + compact.format(day.total).toLowerCase()}
                  </span>
                  <span aria-hidden="true" className="flex h-full w-full items-end justify-center">
                    <span
                      className={cn("w-[55%] max-w-7 rounded-t-md rounded-b-sm", day.total === 0 ? "h-1.5 bg-muted dark:bg-zinc-700/70" : isToday ? "bg-[#dc2626]" : "bg-zinc-900 dark:bg-zinc-700")}
                      style={height ? { height: height + "%" } : undefined}
                    />
                  </span>
                  <span aria-hidden="true" className={cn("w-full border-t border-border pt-1.5 text-[11px] capitalize", isToday ? "font-bold text-brand-foreground" : "text-muted-foreground")}>
                    {day.label}
                  </span>
                </button>
              );
            })}
          </div>
          {selected && (
            <p role="status" className="mt-2 flex flex-wrap justify-between gap-x-2 rounded-xl bg-muted px-2.5 py-1.5 text-xs">
              <span className="text-muted-foreground">{dayName(selected)}</span>
              <strong className="tabular-nums">{currency.format(selected.total)}</strong>
            </p>
          )}
        </>
      ) : (
        <div className="mt-4 grid min-h-32 place-content-center justify-items-center gap-1.5 rounded-2xl border border-border bg-muted p-4 text-center dark:bg-[#191920]">
          <BarChart3 aria-hidden="true" className="size-6 text-muted-foreground" />
          <p className="text-xs font-semibold">Sin movimientos en los últimos 7 días</p>
          <p className="text-xs text-muted-foreground">La evolución aparecerá cuando se registren ingresos.</p>
        </div>
      )}
    </section>
  );
}
