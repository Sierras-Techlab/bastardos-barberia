"use client";

import Link from "next/link";
import { ArrowLeft, CalendarDays, Plus, RefreshCcw, TriangleAlert } from "lucide-react";
import { useState } from "react";

import { CashHistoryTable } from "@/components/cash/cash-history-table";
import { CashPaymentBreakdown } from "@/components/cash/cash-payment-breakdown";
import { CashSalesAudit } from "@/components/cash/cash-sales-audit";
import { CashSummaryCards } from "@/components/cash/cash-summary-cards";
import { IncomeDetailSheet } from "@/components/incomes/income-detail-sheet";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  cashClient as defaultCashClient,
  type CashClient,
} from "@/lib/cash/client";
import {
  incomeClient as defaultIncomeClient,
  type IncomeClient,
} from "@/lib/incomes/client";
import { formatArs } from "@/lib/incomes/income-calculations";
import type { CashDay, PaginatedCashHistory } from "@/types/cash";
import type { IncomeListItem, UserRole } from "@/types/income";

type CashViewProps = {
  initialDay: CashDay;
  initialHistory: PaginatedCashHistory;
  viewerRole: UserRole;
  cashClient?: Pick<CashClient, "getDay" | "list">;
  incomeClient?: Pick<IncomeClient, "get">;
};

const formatLongDate = (date: string) =>
  new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(`${date}T12:00:00-03:00`));

export const CashView = ({
  initialDay,
  initialHistory,
  viewerRole,
  cashClient = defaultCashClient,
  incomeClient = defaultIncomeClient,
}: CashViewProps) => {
  const [day, setDay] = useState(initialDay);
  const [history, setHistory] = useState(initialHistory);
  const [loadingDay, setLoadingDay] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIncome, setSelectedIncome] = useState<IncomeListItem | null>(null);
  const [loadingIncome, setLoadingIncome] = useState(false);

  const loadDay = async (date: string) => {
    setLoadingDay(true);
    setError(null);
    try {
      setDay(await cashClient.getDay(date));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo cargar la caja seleccionada.");
    } finally {
      setLoadingDay(false);
    }
  };

  const loadHistoryPage = async (page: number) => {
    setLoadingHistory(true);
    setError(null);
    try {
      setHistory(await cashClient.list({ page, pageSize: history.pagination.pageSize }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo cargar el historial.");
    } finally {
      setLoadingHistory(false);
    }
  };

  const openIncome = async (incomeId: string) => {
    setLoadingIncome(true);
    setError(null);
    try {
      setSelectedIncome(await incomeClient.get(incomeId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo abrir el ingreso.");
    } finally {
      setLoadingIncome(false);
    }
  };

  return (
    <div className="space-y-7" aria-busy={loadingDay || loadingHistory || loadingIncome}>
      <section className="rounded-[1.8rem] bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-[-0.035em]">
                {day.state === "live" ? "Caja de hoy" : "Caja cerrada"}
              </h2>
              {day.state === "live" ? (
                <Badge className="bg-primary/10 text-primary hover:bg-primary/10">En curso</Badge>
              ) : (
                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Cierre guardado</Badge>
              )}
            </div>
            <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground first-letter:uppercase">
              <CalendarDays className="size-4" />
              {formatLongDate(day.businessDate)}
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {day.state === "live"
                ? "Se actualiza automáticamente con los ingresos y anulaciones del día."
                : "Este cierre es inmutable; las anulaciones posteriores se registran como ajustes auditados."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {day.businessDate !== initialDay.businessDate && (
              <Button type="button" variant="outline" className="rounded-xl" disabled={loadingDay} onClick={() => void loadDay(initialDay.businessDate)}>
                <ArrowLeft /> Volver a hoy
              </Button>
            )}
            <Link href="/incomes/new" className={buttonVariants({ className: "h-9 rounded-xl px-4" })}>
              <Plus /> Cargar ingreso
            </Link>
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            <TriangleAlert className="size-4 shrink-0" /> {error}
          </p>
        )}

        <div className={`mt-5 transition-opacity ${loadingDay ? "opacity-45" : ""}`}>
          <CashSummaryCards summary={day.summary} />
        </div>

        {(day.summary.serviceTotal !== 0 || day.summary.productTotal !== 0) && (
          <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-xl bg-[#f6f5f2] px-4 py-3"><span>Servicios</span><strong className="text-foreground">{formatArs(day.summary.serviceTotal)}</strong></div>
            <div className="flex items-center justify-between rounded-xl bg-[#f6f5f2] px-4 py-3"><span>Productos</span><strong className="text-foreground">{formatArs(day.summary.productTotal)}</strong></div>
          </div>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <CashSalesAudit sales={day.sales} onSelect={(sale) => void openIncome(sale.id)} />
        <div className="space-y-5 lg:pt-[3.75rem]">
          <CashPaymentBreakdown payments={day.payments} />
          {day.adjustments.length > 0 && (
            <section className="rounded-[1.6rem] border border-primary/15 bg-primary/5 p-5">
              <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">Ajustes auditados</p>
              <p className="mt-2 text-lg font-semibold">{day.adjustments.length} {day.adjustments.length === 1 ? "anulación posterior" : "anulaciones posteriores"}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Impacto neto: {formatArs(day.summary.adjustmentBarbershopNet)}</p>
            </section>
          )}
        </div>
      </div>

      <CashHistoryTable items={history.items} selectedDate={day.businessDate} loading={loadingDay} onSelect={(date) => void loadDay(date)} />

      {history.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between gap-4">
          <Button type="button" variant="outline" disabled={loadingHistory || history.pagination.page <= 1} onClick={() => void loadHistoryPage(history.pagination.page - 1)}>Anterior</Button>
          <span className="text-sm text-muted-foreground">Página {history.pagination.page} de {history.pagination.totalPages}</span>
          <Button type="button" variant="outline" disabled={loadingHistory || history.pagination.page >= history.pagination.totalPages} onClick={() => void loadHistoryPage(history.pagination.page + 1)}>Siguiente</Button>
        </div>
      )}

      {loadingIncome && (
        <p role="status" className="fixed right-5 bottom-5 flex items-center gap-2 rounded-full bg-[#202023] px-4 py-2 text-xs text-white shadow-lg"><RefreshCcw className="size-3.5 animate-spin" /> Abriendo ingreso</p>
      )}
      <IncomeDetailSheet income={selectedIncome} open={selectedIncome !== null} viewerRole={viewerRole} onOpenChange={(open) => { if (!open) setSelectedIncome(null); }} />
    </div>
  );
};
