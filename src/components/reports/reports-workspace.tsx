"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { reportClient, type ReportClient } from "@/lib/reports/client";
import type { BusinessReport } from "@/types/report";
import { ReportHero } from "./report-hero";
import { ReportMetricGrid } from "./report-metric-grid";
import { ReportTrendChart } from "./report-trend-chart";
import { ReportComposition } from "./report-composition";
import { ReportRankings } from "./report-rankings";

const monthName = (month: string) => new Intl.DateTimeFormat("es-AR", { month: "long", timeZone: "UTC" }).format(new Date(`${month}-01T12:00:00Z`));
const monthLabel = (month: string) => new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T12:00:00Z`));
export function ReportsWorkspace({ initialReport, client = reportClient }: { initialReport: BusinessReport; client?: Pick<ReportClient, "get"> }) {
  const [report, setReport] = useState(initialReport); const [month, setMonth] = useState(initialReport.month); const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null); const sequence = useRef(0);
  const load = async (nextMonth: string) => { const id = ++sequence.current; setMonth(nextMonth); setLoading(true); setError(null); try { const next = await client.get(nextMonth); if (id !== sequence.current) return; setReport(next); } catch { if (id !== sequence.current) return; setMonth(report.month); setError("No se pudo cargar el reporte. Intentá nuevamente."); } finally { if (id === sequence.current) setLoading(false); } };
  const empty = report.summary.grossIncome === 0 && report.summary.expenses === 0 && report.serviceRanking.length === 0 && report.productRanking.length === 0;
  return <div className="space-y-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-medium">Período analizado</p><p className="text-xs text-muted-foreground">Comparado con el período equivalente anterior.</p></div><select className="h-10 w-48 rounded-xl border border-black/10 bg-white px-3 text-sm outline-none focus:border-primary/50 focus:ring-3 focus:ring-primary/10" aria-label="Mes del reporte" value={month} disabled={loading} onChange={(event) => void load(event.target.value)}>{report.availableMonths.map((availableMonth) => <option key={availableMonth} value={availableMonth}>{monthLabel(availableMonth)}</option>)}</select></div>{error && <div role="alert" className="flex items-center justify-between gap-3 rounded-xl bg-red-50 p-3 text-sm text-red-800"><span>{error}</span><Button variant="outline" size="sm" onClick={() => void load(month)}>Reintentar</Button></div>}{empty ? <div className="rounded-[1.75rem] border bg-white p-8 text-center"><h3 className="text-lg font-semibold">Todavía no hay actividad en este mes</h3><p className="mt-2 text-sm text-muted-foreground">Los ingresos y gastos registrados van a aparecer acá.</p><div className="mt-4 flex justify-center gap-2"><Button render={<Link href="/incomes" />}>Ver ingresos</Button><Button variant="outline" render={<Link href="/expenses" />}>Ver gastos</Button></div></div> : <><ReportHero month={report.month} cutoff={report.period.to} result={report.summary.operatingResult} previousResult={report.previousSummary.operatingResult} projectedResult={report.projection?.operatingResult ?? null} /><ReportMetricGrid current={report.summary} previous={report.previousSummary} /><ReportTrendChart selectedMonth={monthName(report.month)} previousMonth={monthName(report.comparison.month)} daily={report.daily} /><ReportComposition income={report.incomeComposition} payments={report.paymentComposition} expenses={report.expenseComposition} /><ReportRankings services={report.serviceRanking} products={report.productRanking} highlights={report.highlights} /></>}</div>;
}
