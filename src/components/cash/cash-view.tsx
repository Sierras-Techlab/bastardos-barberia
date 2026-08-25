"use client";

import Link from "next/link";
import { ArrowLeft, CalendarDays, Plus, RefreshCcw, ShieldCheck, TriangleAlert, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { CashCloseDialog } from "@/components/cash/cash-close-dialog";
import { CashConfirmDialog } from "@/components/cash/cash-confirm-dialog";
import { CashHistoryTable } from "@/components/cash/cash-history-table";
import { CashOpenDialog } from "@/components/cash/cash-open-dialog";
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
import { differenceLabel } from "@/lib/cash/reconciliation";
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
  cashClient?: CashClient;
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

const reconciliationBadge: Record<"not_applicable" | "pending_confirmation" | "confirmed", { label: string; className: string } | null> = {
  not_applicable: null,
  pending_confirmation: { label: "Pendiente de confirmación", className: "bg-amber-100 text-amber-800 hover:bg-amber-100" },
  confirmed: { label: "Confirmada", className: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" },
};

export const CashView = ({
  initialDay,
  initialHistory,
  viewerRole,
  cashClient = defaultCashClient,
  incomeClient = defaultIncomeClient,
}: CashViewProps) => {
  const router = useRouter();
  const [day, setDay] = useState(initialDay);
  const [history, setHistory] = useState(initialHistory);
  const [loadingDay, setLoadingDay] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIncome, setSelectedIncome] = useState<IncomeListItem | null>(null);
  const [loadingIncome, setLoadingIncome] = useState(false);
  const [opening, setOpening] = useState(false);
  const [closing, setClosing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busyMutation, setBusyMutation] = useState(false);

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

  const onOpenCash = async (input: { openingBalance: number }) => {
    setBusyMutation(true);
    try {
      const updated = await cashClient.open(input);
      setDay(updated);
      toast.success("Caja abierta. Ahora podés cargar ingresos.");
      router.push("/incomes/new");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "No se pudo abrir la caja.");
    } finally {
      setBusyMutation(false);
      setOpening(false);
    }
  };

  const onCloseCash = async (input: { countedCash: number }) => {
    setBusyMutation(true);
    try {
      const updated = await cashClient.close(input);
      setDay(updated);
      toast.success(
        updated.lifecycle.reconciliationState === "confirmed"
          ? "Caja cerrada y conteo confirmado."
          : "Caja cerrada. Quedó pendiente de confirmación.",
      );
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "No se pudo cerrar la caja.");
    } finally {
      setBusyMutation(false);
      setClosing(false);
    }
  };

  const onConfirmCash = async (input: { countedCash: number }) => {
    if (!day.id) return;
    setBusyMutation(true);
    try {
      const updated = await cashClient.confirm(day.id, input);
      setDay(updated);
      toast.success("Conteo confirmado.");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "No se pudo confirmar el conteo.");
    } finally {
      setBusyMutation(false);
      setConfirming(false);
    }
  };

const isManager = viewerRole === "owner" || viewerRole === "admin";
  const lifecycle = resolveLifecycle(day);
  const isToday = day.businessDate === initialDay.businessDate;
  const canOpen = isManager && isToday && day.state === "live" && day.id === null;
  const canClose = isManager && isToday && day.state === "live" && day.id !== null;
  const canConfirm = isManager && isToday && day.state === "closed" && lifecycle.reconciliationState === "pending_confirmation";

  return (
    <div className="space-y-7" aria-busy={loadingDay || loadingHistory || loadingIncome || busyMutation}>
      <section className="rounded-[1.8rem] bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-[-0.035em]">
                {day.state === "live" ? "Caja de hoy" : "Caja cerrada"}
              </h2>
              {day.state === "live" ? (
                day.id === null ? (
                  <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Sin abrir</Badge>
                ) : (
                  <Badge className="bg-primary/10 text-primary hover:bg-primary/10">En curso</Badge>
                )
              ) : (
                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Cierre guardado</Badge>
              )}
              {lifecycle && (() => {
                const meta = reconciliationBadge[lifecycle.reconciliationState];
                return meta ? <Badge className={meta.className}>{meta.label}</Badge> : null;
              })()}
            </div>
            <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground first-letter:uppercase">
              <CalendarDays className="size-4" />
              {formatLongDate(day.businessDate)}
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {day.state === "live"
                ? day.id === null
                  ? "Aún no abriste la caja de hoy. Definí el saldo inicial físico antes de cargar ingresos."
                  : "Se actualiza automáticamente con los ingresos y anulaciones del día."
                : "Este cierre es inmutable; las anulaciones posteriores se registran como ajustes auditados."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!isToday && (
              <Button type="button" variant="outline" className="rounded-xl" disabled={loadingDay} onClick={() => void loadDay(initialDay.businessDate)}>
                <ArrowLeft /> Volver a hoy
              </Button>
            )}
            {canOpen && (
              <Button type="button" className="rounded-xl" onClick={() => setOpening(true)}>
                <Wallet /> Abrir caja
              </Button>
            )}
            {canClose && (
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => setClosing(true)}>
                <ShieldCheck /> Cerrar caja
              </Button>
            )}
            {canConfirm && (
              <Button type="button" className="rounded-xl" onClick={() => setConfirming(true)}>
                <ShieldCheck /> Confirmar conteo
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

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <LifecycleField label="Saldo inicial" value={lifecycle ? formatArs(lifecycle.openingBalance) : "—"} hint={lifecycle?.openingSource === "manual" ? "Apertura manual" : lifecycle?.openingSource === "first_income" ? "Apertura automática" : null} />
          <LifecycleField label="Efectivo esperado" value={lifecycle ? formatArs(lifecycle.expectedCash) : "—"} />
          <LifecycleField label="Conteo físico" value={lifecycle.countedCash !== null ? formatArs(lifecycle.countedCash) : "—"} hint={lifecycle.countedCash !== null ? differenceLabel(lifecycle.difference) : null} accent={lifecycle.countedCash !== null && lifecycle.difference !== 0} />
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <CashSalesAudit sales={day.sales} onSelect={(sale) => void openIncome(sale.id)} />
        <div className="cash-payment-column space-y-5">
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

      {opening && (
        <CashOpenDialog
          openingBalance={0}
          onClose={() => setOpening(false)}
          onConfirm={onOpenCash}
        />
      )}

      {closing && lifecycle && (
        <CashCloseDialog
          expectedCash={lifecycle.expectedCash}
          mode="manual"
          onClose={() => setClosing(false)}
          onConfirm={onCloseCash}
        />
      )}

      {confirming && lifecycle && (
        <CashConfirmDialog
          expectedCash={lifecycle.expectedCash}
          onClose={() => setConfirming(false)}
          onConfirm={onConfirmCash}
        />
      )}

      {loadingIncome && (
        <p role="status" className="fixed right-5 bottom-5 flex items-center gap-2 rounded-full bg-[#202023] px-4 py-2 text-xs text-white shadow-lg"><RefreshCcw className="size-3.5 animate-spin" /> Abriendo ingreso</p>
      )}
      <IncomeDetailSheet income={selectedIncome} open={selectedIncome !== null} viewerRole={viewerRole} onOpenChange={(open) => { if (!open) setSelectedIncome(null); }} />
    </div>
  );
};

const resolveLifecycle = (day: CashDay) => day.lifecycle ?? {
  openingBalance: 0,
  openingSource: null,
  openedAt: null,
  openedBy: null,
  expectedCash: 0,
  countedCash: null,
  difference: null,
  closeMode: null,
  reconciliationState: "not_applicable" as const,
};

type LifecycleFieldProps = { label: string; value: string; hint?: string | null; accent?: boolean };
const LifecycleField = ({ label, value, hint, accent }: LifecycleFieldProps) => (
  <div className="rounded-2xl border border-black/8 bg-[#f6f5f2] p-4">
    <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className={`mt-1 text-xl font-semibold ${accent ? "text-red-700" : ""}`}>{value}</p>
    {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
  </div>
);
