"use client";

import { ReceiptText, RotateCcw, Settings2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { IncomeDetailSheet } from "@/components/incomes/income-detail-sheet";
import { IncomeFilters } from "@/components/incomes/income-filters";
import { IncomeMetrics } from "@/components/incomes/income-metrics";
import { IncomeMobileList } from "@/components/incomes/income-mobile-list";
import { IncomeTable } from "@/components/incomes/income-table";
import { IncomeVoidDialog } from "@/components/incomes/income-void-dialog";
import { PaymentMethodsDialog } from "@/components/incomes/payment-methods-dialog";
import { Button } from "@/components/ui/button";
import { incomeClient as defaultIncomeClient, type IncomeClient } from "@/lib/incomes/client";
import type { CurrentUser, Employee, IncomeListFilters, IncomeListQuery, IncomeListRow, PaginatedIncomes } from "@/types/income";
import { toRoleSafeIncomeQuery } from "@/lib/incomes/income-view-query";
import { paymentMethodClient as defaultPaymentMethodClient, type PaymentMethodClient } from "@/lib/payment-methods/client";
import type { PaymentMethod } from "@/types/payment-method";

type Props = { data: PaginatedIncomes; initialQuery: IncomeListQuery; currentUser: CurrentUser; employees: Employee[]; paymentMethods: PaymentMethod[]; canViewAll: boolean; canVoid: boolean; incomeClient?: Pick<IncomeClient, "listAs" | "list" | "void">; paymentMethodClient?: Pick<PaymentMethodClient, "create" | "update" | "deactivate" | "remove"> };
const asFilters = (query: IncomeListQuery): IncomeListFilters => ({ query: query.query ?? "", dateFrom: query.dateFrom ?? "", dateTo: query.dateTo ?? "", employeeId: query.userId ?? "", paymentMethodId: query.paymentMethodId ?? "all", kind: query.kind ?? "all", status: query.status ?? "all" });

export const IncomesView = ({ data, initialQuery, currentUser, employees, paymentMethods: initialPaymentMethods, canViewAll, canVoid, incomeClient = defaultIncomeClient, paymentMethodClient = defaultPaymentMethodClient }: Props) => {
  const initialFilters = { ...asFilters(initialQuery), ...(!canViewAll && { employeeId: "" }) }; const [filters, setFilters] = useState(initialFilters); const [result, setResult] = useState<PaginatedIncomes>(data); const [selected, setSelected] = useState<IncomeListRow | null>(null); const [voiding, setVoiding] = useState<IncomeListRow | null>(null); const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null); const [paymentMethods, setPaymentMethods] = useState(initialPaymentMethods); const [managingPaymentMethods, setManagingPaymentMethods] = useState(false); const requestSequence = useRef(0);
  const load = async (query: IncomeListQuery) => { const sequence = ++requestSequence.current; setLoading(true); setError(null); try { const next = await incomeClient.listAs(currentUser.role, query); if (sequence === requestSequence.current) setResult(next); } catch (caught) { if (sequence === requestSequence.current) setError(caught instanceof Error ? caught.message : "No se pudo cargar el historial."); } finally { if (sequence === requestSequence.current) setLoading(false); } };
  const changeFilters = (next: IncomeListFilters) => { const safe = canViewAll ? next : { ...next, employeeId: "" }; setFilters(safe); void load(toRoleSafeIncomeQuery(safe, currentUser.role)); };
  const changePage = (page: number) => void load(toRoleSafeIncomeQuery(filters, currentUser.role, page, result.pagination.pageSize));
  const canClear = JSON.stringify(filters) !== JSON.stringify(initialFilters);
  const showEmployeeColumn = canViewAll;
  const isEmployeeView = currentUser.role === "employee";

  return <div className="space-y-5"><IncomeMetrics metrics={result.metrics} role={currentUser.role} /><IncomeFilters role={currentUser.role} canFilterEmployees={canViewAll} employees={employees} paymentMethods={paymentMethods} value={filters} onChange={changeFilters} onClear={() => changeFilters(initialFilters)} canClear={canClear} />
    {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    <section aria-labelledby="income-history-title" aria-busy={loading}><div className="mb-3 flex items-end justify-between gap-4 px-1"><div><h2 id="income-history-title" className="text-lg font-semibold">{isEmployeeView ? "Tus ventas registradas" : "Historial de ventas"}</h2><p className="text-sm text-muted-foreground">{result.pagination.total} {result.pagination.total === 1 ? "movimiento" : "movimientos"}</p></div><div className="flex items-center gap-2">{canViewAll && <Button type="button" variant="outline" className="rounded-xl bg-white" onClick={() => setManagingPaymentMethods(true)}><Settings2 /> Administrar medios de pago</Button>}<p className="hidden text-xs text-muted-foreground sm:block">Los anulados no se suman al resumen</p></div></div>
      {result.items.length ? <><div className={`hidden md:block ${loading ? "opacity-60" : ""}`}><IncomeTable incomes={result.items} onSelect={setSelected} showEmployeeColumn={showEmployeeColumn} /></div><div className={`md:hidden ${loading ? "opacity-60" : ""}`}><IncomeMobileList incomes={result.items} onSelect={setSelected} /></div><div className="mt-4 flex items-center justify-between"><Button variant="outline" disabled={loading || result.pagination.page <= 1} onClick={() => changePage(result.pagination.page - 1)}>Anterior</Button><span className="text-sm text-muted-foreground">Página {result.pagination.page} de {Math.max(result.pagination.totalPages, 1)}</span><Button variant="outline" disabled={loading || result.pagination.page >= result.pagination.totalPages} onClick={() => changePage(result.pagination.page + 1)}>Siguiente</Button></div></> : <div className="flex min-h-64 flex-col items-center justify-center rounded-[1.6rem] bg-white px-6 text-center shadow-sm"><ReceiptText className="size-5 text-primary" /><h3 className="mt-4 font-semibold">No encontramos ingresos</h3><p className="mt-1 text-sm text-muted-foreground">Probá cambiando la búsqueda o limpiando los filtros.</p><Button type="button" variant="outline" className="mt-4 rounded-xl" onClick={() => changeFilters(initialFilters)}><RotateCcw /> Limpiar filtros</Button></div>}
    </section>
    <IncomeDetailSheet income={selected} open={selected !== null} viewerRole={currentUser.role} onOpenChange={(open) => { if (!open) setSelected(null); }} canVoid={canVoid} onVoid={(income) => setVoiding(income)} />
    {voiding && canViewAll && "total" in voiding && <IncomeVoidDialog income={voiding} onClose={() => setVoiding(null)} onConfirm={async () => { const updated = await incomeClient.void(voiding.id); setSelected(updated as IncomeListRow); setVoiding(null); await load(toRoleSafeIncomeQuery(filters, currentUser.role, result.pagination.page, result.pagination.pageSize)); toast.success("Venta anulada correctamente."); }} />}
    {managingPaymentMethods && <PaymentMethodsDialog methods={paymentMethods} paymentMethodClient={paymentMethodClient} onMethodsChange={setPaymentMethods} onClose={() => setManagingPaymentMethods(false)} />}
    {!canViewAll && <span className="sr-only">Vista limitada al usuario autenticado</span>}
  </div>;
};
