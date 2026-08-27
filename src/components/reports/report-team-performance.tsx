"use client";

import { useState } from "react";
import { AlertTriangle, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { ReportTeamMember } from "@/types/report";

const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const roleLabel = { owner: "Owner", admin: "Administrador", employee: "Empleado" } as const;

const workedTime = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours ? `${hours} h` : ""}${hours && remainder ? " " : ""}${remainder ? `${remainder} min` : ""} trabajadas`;
};

function TeamMemberCard({ member }: { member: ReportTeamMember }) {
  const change = member.previous.grossIncome === 0
    ? null
    : Math.round((member.current.grossIncome - member.previous.grossIncome) * 100 / Math.abs(member.previous.grossIncome));
  return <article className="rounded-2xl border border-black/5 bg-[#f8f7f4] p-4">
    <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold">{member.name}</h3><p className="text-xs text-muted-foreground">{roleLabel[member.role]} · {member.current.saleCount} {member.current.saleCount === 1 ? "venta" : "ventas"}</p></div><p className="text-xs font-medium text-muted-foreground">{change === null ? "Sin base de comparación" : `${change >= 0 ? "+" : ""}${change}% vs. período anterior`}</p></div>
    <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">{[
      ["Facturación", member.current.grossIncome], ["Neto barbería", member.current.barbershopNet],
      ["Comisión", member.current.commission], ["Ticket promedio", member.current.averageTicket],
    ].map(([label, value]) => <div key={label as string}><p className="text-xs text-muted-foreground">{label as string}</p><p className="mt-1 font-semibold">{value === null ? "Sin ventas" : money.format(value as number)}</p></div>)}</div>
    <div className="mt-4 flex flex-wrap gap-2 text-xs"><span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1.5 text-muted-foreground"><Clock3 className="size-3.5" />{member.current.workedMinutes === null ? "No aplica" : workedTime(member.current.workedMinutes)}</span>{member.current.grossPerHour !== null && <span className="rounded-full bg-white px-2.5 py-1.5 text-muted-foreground">{money.format(member.current.grossPerHour)} / h facturado</span>}{member.current.netPerHour !== null && <span className="rounded-full bg-white px-2.5 py-1.5 text-muted-foreground">{money.format(member.current.netPerHour)} / h neto</span>}{member.current.outsideSessionSaleCount > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1.5 text-amber-900"><AlertTriangle className="size-3.5" />{member.current.outsideSessionSaleCount} {member.current.outsideSessionSaleCount === 1 ? "venta" : "ventas"} fuera de jornada</span>}</div>
  </article>;
}

export function ReportTeamPerformance({ members }: { members: ReportTeamMember[] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? members : members.slice(0, 5);
  return <Card className="bg-white"><CardHeader><div><h2 className="font-heading text-base font-medium">Rendimiento del equipo</h2><p className="mt-1 text-sm text-muted-foreground">Producción, comisiones y tiempo trabajado en el período.</p></div></CardHeader><CardContent>{shown.length ? <div className="space-y-3">{shown.map((member) => <TeamMemberCard key={member.id} member={member} />)}</div> : <p className="text-sm text-muted-foreground">Todavía no hay actividad del equipo en este período.</p>}{members.length > 5 && <Button variant="ghost" className="mt-3 px-0" onClick={() => setExpanded((value) => !value)}>{expanded ? "Ocultar detalle" : "Ver todo el equipo"}</Button>}</CardContent></Card>;
}
