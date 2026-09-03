"use client";

import {
  Banknote,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Pencil,
  ReceiptText,
  Scissors,
  TriangleAlert,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { WorkSessionCorrectionDialog } from "@/components/work-sessions/work-session-correction-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatArs } from "@/lib/incomes/income-calculations";
import {
  workSessionClient as defaultWorkSessionClient,
  type WorkSessionClient,
} from "@/lib/work-sessions/client";
import type {
  EmployeeWorkSession,
  ManagerWorkSession,
  PaginatedEmployeeWorkSessions,
  PaginatedManagerWorkSessions,
  PaginatedWorkSessions,
} from "@/types/work-session";

type WorkSessionHistoryProps = {
  workSessionClient?: Pick<WorkSessionClient, "list" | "correct">;
} & (
  | {
      viewerRole: "employee";
      initialData: PaginatedEmployeeWorkSessions;
    }
  | {
      viewerRole: "owner" | "admin";
      initialData: PaginatedManagerWorkSessions;
      employeeOptions: EmployeeWorkSession["employee"][];
    }
);

const formatDate = (date: string) =>
  new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(`${date}T12:00:00-03:00`));

const formatTime = (timestamp: string) =>
  new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(timestamp));

const formatMinutes = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${remainder} min`;
  if (remainder === 0) return `${hours} h`;
  return `${hours} h ${remainder} min`;
};

const isManagerSession = (
  session: EmployeeWorkSession | ManagerWorkSession,
): session is ManagerWorkSession => "grossTotal" in session.metrics;

const WorkSessionHistoryState = (props: WorkSessionHistoryProps) => {
  const {
    viewerRole,
    initialData,
    workSessionClient = defaultWorkSessionClient,
  } = props;
  const isManager = viewerRole !== "employee";
  const [data, setData] = useState<PaginatedWorkSessions>(initialData);
  const [employeeId, setEmployeeId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [correcting, setCorrecting] = useState<ManagerWorkSession | null>(null);
  const requestSequence = useRef(0);
  const employees =
    props.viewerRole === "employee" ? [] : props.employeeOptions;

  const load = async (
    next: { employeeId: string; dateFrom: string; dateTo: string },
    page = 1,
  ) => {
    const requestId = ++requestSequence.current;
    setLoading(true);
    setError(null);
    try {
      const response = await workSessionClient.list(
        {
          employeeId: next.employeeId || undefined,
          dateFrom: next.dateFrom || undefined,
          dateTo: next.dateTo || undefined,
          page,
          pageSize: data.pagination.pageSize,
        },
        viewerRole,
      );
      if (requestId !== requestSequence.current) return null;
      setData(response);
      return response;
    } catch (caught) {
      if (requestId !== requestSequence.current) return null;
      const message =
        caught instanceof Error
          ? caught.message
          : "No se pudo cargar el historial de jornadas.";
      setError(message);
      toast.error(message);
      return null;
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  };

  const allItems: Array<EmployeeWorkSession | ManagerWorkSession> = data.items;
  const managerTotals = allItems.filter(isManagerSession).reduce(
    (totals, session) => ({
      grossTotal: totals.grossTotal + session.metrics.grossTotal,
      barbershopNet: totals.barbershopNet + session.metrics.barbershopNet,
      employeeCommission:
        totals.employeeCommission + session.metrics.employeeCommission,
      saleCount: totals.saleCount + session.metrics.saleCount,
    }),
    { grossTotal: 0, barbershopNet: 0, employeeCommission: 0, saleCount: 0 },
  );

  const reloadAfterCorrection = async () => {
    const filters = { employeeId, dateFrom, dateTo };
    const response = await load(filters, data.pagination.page);
    if (!response) return;

    const lastValidPage = Math.max(1, response.pagination.totalPages);
    if (response.pagination.page > lastValidPage) {
      await load(filters, lastValidPage);
    }
  };

  return (
    <div className="space-y-6" aria-busy={loading}>
      {isManager && (
        <section aria-label="Resumen de presentismo de la página actual" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="sm:col-span-2 xl:col-span-4">
            <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">Página actual</p>
            <p className="mt-1 text-sm text-muted-foreground">Los totales reflejan únicamente las jornadas visibles en esta página.</p>
          </div>
          {[
            { label: "Ventas brutas", value: formatArs(managerTotals.grossTotal), icon: Banknote },
            { label: "Neto barbería", value: formatArs(managerTotals.barbershopNet), icon: Scissors },
            { label: "Comisiones", value: formatArs(managerTotals.employeeCommission), icon: ReceiptText },
            { label: "Ventas registradas", value: String(managerTotals.saleCount), icon: CalendarClock },
          ].map((metric) => (
            <article key={metric.label} className="rounded-[1.4rem] bg-white p-4 shadow-sm ring-1 ring-black/5">
              <span className="flex size-9 items-center justify-center rounded-xl bg-red-50 text-primary"><metric.icon className="size-4" /></span>
              <p className="mt-4 text-xs text-muted-foreground">{metric.label}</p>
              <p className="mt-1 text-xl font-semibold tracking-[-0.03em]">{metric.value}</p>
            </article>
          ))}
        </section>
      )}

      {isManager && (
        <section aria-label="Filtros de presentismo" className="rounded-[1.5rem] bg-white p-4 shadow-sm ring-1 ring-black/5">
          <div className="grid gap-3 xl:grid-cols-[minmax(12rem,1fr)_10rem_10rem_auto] xl:items-end">
            <label className="space-y-1.5 text-sm font-medium">
              Empleado
              <select
                aria-label="Filtrar por empleado"
                value={employeeId}
                onChange={(event) => {
                  const next = event.target.value;
                  setEmployeeId(next);
                  void load({ employeeId: next, dateFrom, dateTo });
                }}
                className="h-10 w-full rounded-xl border border-black/10 bg-[#f7f6f3] px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
              >
                <option value="">Todos los empleados</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              Desde
              <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="h-10 rounded-xl border-black/10 bg-[#f7f6f3]" />
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              Hasta
              <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="h-10 rounded-xl border-black/10 bg-[#f7f6f3]" />
            </label>
            <Button type="button" variant="outline" className="h-10 rounded-xl" disabled={loading} onClick={() => void load({ employeeId, dateFrom, dateTo })}>
              Aplicar fechas
            </Button>
          </div>
        </section>
      )}

      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          <TriangleAlert className="size-4 shrink-0" /> {error}
        </p>
      )}

      <section aria-labelledby="work-session-history-title">
        <div className="mb-3 px-1">
          <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">{isManager ? "Registro del equipo" : "Mi registro"}</p>
          <h3 id="work-session-history-title" className="mt-1 text-lg font-semibold">Historial de jornadas</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {isManager
              ? "Revisá horarios, producción y correcciones de cada empleado."
              : "Consultá tus horarios, ventas y comisión registrada por jornada."}
          </p>
        </div>

        {data.items.length > 0 ? (
          <>
            <div className="hidden overflow-x-auto rounded-[1.5rem] bg-white shadow-sm ring-1 ring-black/5 xl:block">
              <table aria-label="Historial de jornadas" className={`w-full text-left text-sm ${isManager ? "min-w-[72rem]" : "min-w-[44rem]"}`}>
                <thead className="border-b border-black/5 bg-[#f8f7f4] text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Fecha</th>
                    {isManager && <th className="px-4 py-3 font-medium">Empleado</th>}
                    <th className="px-4 py-3 font-medium">Horario</th>
                    <th className="px-4 py-3 text-right font-medium">Tiempo</th>
                    <th className="px-4 py-3 text-right font-medium">Ventas</th>
                    {isManager ? (
                      <>
                        <th className="px-4 py-3 text-right font-medium">Bruto</th>
                        <th className="px-4 py-3 text-right font-medium">Neto</th>
                        <th className="px-4 py-3 text-right font-medium">Comisión</th>
                        <th className="w-14 px-2 py-3"><span className="sr-only">Acciones</span></th>
                      </>
                    ) : (
                      <th className="px-4 py-3 text-right font-medium">Mi comisión</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {data.items.map((session) => (
                    <tr key={session.id} className="transition-colors hover:bg-[#faf9f6]">
                      <td className="px-4 py-3.5 font-medium">{formatDate(session.businessDate)}</td>
                      {isManager && <td className="px-4 py-3.5">{session.employee.firstName} {session.employee.lastName}</td>}
                      <td className="px-4 py-3.5"><span>{formatTime(session.startedAt)}</span><span className="text-muted-foreground"> — {session.endedAt ? formatTime(session.endedAt) : "En curso"}</span></td>
                      <td className="px-4 py-3.5 text-right">{formatMinutes(session.metrics.workedMinutes)}</td>
                      <td className="px-4 py-3.5 text-right">{session.metrics.saleCount}</td>
                      {isManager && isManagerSession(session) ? (
                        <>
                          <td className="px-4 py-3.5 text-right">{formatArs(session.metrics.grossTotal)}</td>
                          <td className="px-4 py-3.5 text-right font-semibold">{formatArs(session.metrics.barbershopNet)}</td>
                          <td className="px-4 py-3.5 text-right font-semibold">{formatArs(session.metrics.employeeCommission)}</td>
                          <td className="px-2 py-3.5"><Button type="button" variant="ghost" size="icon" aria-label={`Corregir jornada de ${session.employee.firstName} ${session.employee.lastName}`} onClick={() => setCorrecting(session)}><Pencil /></Button></td>
                        </>
                      ) : !isManager ? (
                        <td className="px-4 py-3.5 text-right font-semibold">{formatArs(session.metrics.employeeCommission)}</td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul aria-label="Historial de jornadas en móvil" className="space-y-3 xl:hidden">
              {data.items.map((session) => (
                <li key={session.id} className="rounded-[1.4rem] bg-white p-4 shadow-sm ring-1 ring-black/5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{isManager ? `${session.employee.firstName} ${session.employee.lastName}` : formatDate(session.businessDate)}</p>
                      {isManager && <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(session.businessDate)}</p>}
                    </div>
                    <Badge className={session.state === "open" ? "bg-red-50 text-primary hover:bg-red-50" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"}>{session.state === "open" ? "En curso" : "Cerrada"}</Badge>
                  </div>
                  <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Clock3 className="size-4" /> {formatTime(session.startedAt)} — {session.endedAt ? formatTime(session.endedAt) : "ahora"}</p>
                  <dl className={`mt-4 grid gap-3 text-sm ${isManager ? "grid-cols-2" : "grid-cols-3"}`}>
                    <div><dt className="text-xs text-muted-foreground">Tiempo</dt><dd className="mt-0.5 font-medium">{formatMinutes(session.metrics.workedMinutes)}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Ventas</dt><dd className="mt-0.5 font-medium">{session.metrics.saleCount}</dd></div>
                    {isManager && isManagerSession(session) ? (
                      <>
                        <div><dt className="text-xs text-muted-foreground">Bruto</dt><dd className="mt-0.5 font-medium">{formatArs(session.metrics.grossTotal)}</dd></div>
                        <div><dt className="text-xs text-muted-foreground">Neto</dt><dd className="mt-0.5 font-semibold">{formatArs(session.metrics.barbershopNet)}</dd></div>
                        <div><dt className="text-xs text-muted-foreground">Comisión</dt><dd className="mt-0.5 font-semibold">{formatArs(session.metrics.employeeCommission)}</dd></div>
                      </>
                    ) : (
                      <div><dt className="text-xs text-muted-foreground">Mi comisión</dt><dd className="mt-0.5 font-semibold">{formatArs(session.metrics.employeeCommission)}</dd></div>
                    )}
                  </dl>
                  {isManager && isManagerSession(session) && (
                    <Button type="button" variant="outline" className="mt-4 w-full rounded-xl" onClick={() => setCorrecting(session)}><Pencil /> Corregir jornada</Button>
                  )}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="flex min-h-44 flex-col items-center justify-center rounded-[1.5rem] bg-white px-6 text-center shadow-sm ring-1 ring-black/5">
            <CalendarClock className="size-6 text-muted-foreground/55" />
            <p className="mt-3 font-semibold">Todavía no hay jornadas</p>
            <p className="mt-1 text-sm text-muted-foreground">Las entradas y salidas registradas aparecerán acá.</p>
          </div>
        )}
      </section>

      {data.pagination.totalPages > 0 && (
        <nav aria-label="Paginación de jornadas" className="flex flex-wrap items-center justify-between gap-3">
          <Button type="button" variant="outline" className="rounded-xl" disabled={loading || data.pagination.page <= 1} onClick={() => void load({ employeeId, dateFrom, dateTo }, data.pagination.page - 1)}><ChevronLeft /> Anterior</Button>
          <span className="text-sm text-muted-foreground">Página {data.pagination.page} de {data.pagination.totalPages}</span>
          <Button type="button" variant="outline" className="rounded-xl" disabled={loading || data.pagination.page >= data.pagination.totalPages} onClick={() => void load({ employeeId, dateFrom, dateTo }, data.pagination.page + 1)}>Siguiente <ChevronRight /></Button>
        </nav>
      )}

      {isManager && correcting && (
        <WorkSessionCorrectionDialog session={correcting} workSessionClient={workSessionClient} onClose={() => setCorrecting(null)} onSaved={reloadAfterCorrection} />
      )}
    </div>
  );
};

export const WorkSessionHistory = (props: WorkSessionHistoryProps) => {
  if (props.viewerRole === "employee") {
    return (
      <WorkSessionHistoryState
        key={JSON.stringify(props.initialData)}
        {...props}
      />
    );
  }

  return <WorkSessionHistoryState {...props} />;
};
