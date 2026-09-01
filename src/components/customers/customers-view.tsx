"use client";

import { Mail, Pencil, Phone, RotateCcw, Search, Trash2, UserRoundPlus, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CustomerDeleteDialog } from "@/components/customers/customer-delete-dialog";
import { CustomerEditorDialog } from "@/components/customers/customer-editor-dialog";
import { CustomerVisitsDialog } from "@/components/customers/customer-visits-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { customerClient as defaultCustomerClient, type CustomerClient } from "@/lib/customers/client";
import { calculateCustomerMetrics, filterCustomers, sortCustomers } from "@/lib/customers/customer-catalog";
import { formatFixedSchedule } from "@/lib/customers/fixed-customers";
import { formatLastVisit } from "@/lib/customers/last-visit";
import type { FrontendCustomerEditorInput } from "@/lib/customers/frontend-customer-contracts";
import type {
  Customer,
  CustomerCatalogData,
  CustomerScheduleFilter,
  CustomerSort,
} from "@/types/customer";
import type { FixedCustomerMonth } from "@/types/fixed-customer-payment";

export type CustomerEditorProfessional = { id: string; firstName: string; lastName: string; isActive: boolean };
export type CustomersViewProps = {
  data: CustomerCatalogData;
  canDelete: boolean;
  currentUserId: string;
  currentUserRole: "owner" | "admin" | "employee";
  availableProfessionals?: CustomerEditorProfessional[];
  onOpenFixedPayment?: (customer: Customer) => void;
  fixedCustomerMonths?: FixedCustomerMonth[];
  customerClient?: CustomerClient;
  today: string;
};
const formatDate = (value: string) => new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value));

export const CustomersView = ({
  data,
  canDelete,
  currentUserId,
  currentUserRole,
  availableProfessionals = [],
  onOpenFixedPayment,
  fixedCustomerMonths = [],
  customerClient = defaultCustomerClient,
  today,
}: CustomersViewProps) => {
  const [customers, setCustomers] = useState(() => data.customers);
  const [query, setQuery] = useState("");
  const [scheduleFilter, setScheduleFilter] = useState<CustomerScheduleFilter>("all");
  const [sort, setSort] = useState<CustomerSort>("original");
  const [editor, setEditor] = useState<{ mode: "create" | "edit"; customer: Customer | null } | null>(null);
  const [deleting, setDeleting] = useState<Customer | null>(null);
  const [visiting, setVisiting] = useState<Customer | null>(null);
  const displayed = useMemo(
    () => sortCustomers(filterCustomers(customers, query, scheduleFilter), sort),
    [customers, query, scheduleFilter, sort],
  );
  const metrics = useMemo(() => calculateCustomerMetrics(customers), [customers]);

  const save = async (input: FrontendCustomerEditorInput) => {
    const saved = editor?.mode === "edit" && editor.customer
      ? await customerClient.update(editor.customer.id, {
          ...input,
          expectedScheduleVersion: editor.customer.fixedScheduleVersion ?? 0,
        })
      : await customerClient.create(input);
    setCustomers((current) => editor?.mode === "edit"
      ? current.map((customer) => customer.id === saved.id ? saved : customer)
      : [...current, saved]);
    toast.success(editor?.mode === "edit" ? "Cliente actualizado correctamente." : "Cliente añadido correctamente.");
    setEditor(null);
    return saved;
  };

  const visitsButton = (customer: Customer) => (
    <button
      type="button"
      disabled={customer.visits === 0}
      aria-label={`Ver ${customer.visits} ${customer.visits === 1 ? "visita" : "visitas"} de ${customer.firstName} ${customer.lastName}`}
      onClick={() => setVisiting(customer)}
      className="font-medium underline-offset-4 enabled:hover:text-primary enabled:hover:underline disabled:cursor-default"
    >
      {customer.visits} {customer.visits === 1 ? "visita" : "visitas"}
    </button>
  );
  const editButton = (customer: Customer) => <Button variant="ghost" size="icon" aria-label={`Editar ${customer.firstName} ${customer.lastName}`} onClick={() => setEditor({ mode: "edit", customer })} className="rounded-xl"><Pencil /></Button>;
  const deleteButton = (customer: Customer) => canDelete ? <Button variant="ghost" size="icon" aria-label={`Eliminar ${customer.firstName} ${customer.lastName}`} onClick={() => setDeleting(customer)} className="rounded-xl text-destructive"><Trash2 /></Button> : null;
  const canPayMonth = (customer: Customer) => {
    if (!customer.fixedSchedule) return false;
    if (currentUserRole === "owner" || currentUserRole === "admin") return true;
    return customer.fixedSchedule.responsibleProfessional.id === currentUserId;
  };
  const payMonthButton = (customer: Customer) => canPayMonth(customer) && onOpenFixedPayment
    ? fixedCustomerMonths.find((month) => month.customer.id === customer.id)?.status === "paid"
      ? <Button variant="outline" size="sm" disabled aria-label={`Mensualidad cobrada de ${customer.firstName} ${customer.lastName}`} className="rounded-xl">Mensualidad cobrada</Button>
      : <Button variant="outline" size="sm" aria-label={`Cobrar mensualidad de ${customer.firstName} ${customer.lastName}`} onClick={() => onOpenFixedPayment(customer)} className="rounded-xl">Cobrar mensualidad</Button>
    : null;

  return <div className="space-y-5">
    <section aria-label="Resumen de clientes" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {[["Clientes", metrics.totalCustomers, "Base registrada"], ["Nuevos", metrics.newCustomers, "Último período"], ["Visitas", metrics.totalVisits, "Ingresos asociados"]].map(([label, value, detail], index) => (
        <Card key={String(label)} className={`min-h-32 rounded-[1.5rem] border-0 py-0 shadow-sm ${index === 0 ? "bg-[#202023] text-white" : index === 1 ? "bg-primary text-white" : "bg-white"}`}>
          <CardContent className="flex h-full items-end justify-between p-5"><div><p className="text-xs opacity-65">{label}</p><p className="mt-4 text-2xl font-semibold">{value}</p><p className="mt-1 text-[11px] opacity-55">{detail}</p></div><UsersRound className="size-5 opacity-60" /></CardContent>
        </Card>
      ))}
    </section>

    <section aria-label="Filtros de clientes" className="rounded-[1.4rem] bg-white p-3 shadow-sm sm:p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(16rem,1fr)_12rem_12rem_auto]">
        <div className="relative min-w-0 sm:col-span-2 lg:col-span-1"><Search className="pointer-events-none absolute top-3.5 left-3.5 size-4 text-muted-foreground" /><Input type="search" aria-label="Buscar clientes" placeholder="Nombre, email o teléfono" value={query} onChange={(event) => setQuery(event.target.value)} className="h-11 rounded-xl bg-[#f6f5f2] pl-10 shadow-none" /></div>
        <select aria-label="Filtrar clientes por horario" value={scheduleFilter} onChange={(event) => setScheduleFilter(event.target.value as CustomerScheduleFilter)} className="h-11 rounded-xl border border-black/10 bg-[#f6f5f2] px-3 text-sm"><option value="all">Todos los clientes</option><option value="fixed">Clientes fijos</option><option value="not-fixed">Sin horario fijo</option></select>
        <select aria-label="Ordenar clientes" value={sort} onChange={(event) => setSort(event.target.value as CustomerSort)} className="h-11 rounded-xl border border-black/10 bg-[#f6f5f2] px-3 text-sm"><option value="original">Orden original</option><option value="visits-desc">Más visitas</option><option value="visits-asc">Menos visitas</option><option value="newest">Más recientes</option><option value="oldest">Más antiguos</option></select>
        <Button type="button" variant="ghost" disabled={!query && scheduleFilter === "all" && sort === "original"} onClick={() => { setQuery(""); setScheduleFilter("all"); setSort("original"); }} className="h-11 rounded-xl"><RotateCcw /> Limpiar</Button>
      </div>
    </section>

    <section aria-labelledby="customer-list-title">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3 px-1"><div className="min-w-0"><h2 id="customer-list-title" className="text-lg font-semibold">Directorio de clientes</h2><p className="text-sm text-muted-foreground">{displayed.length} clientes</p></div><Button onClick={() => setEditor({ mode: "create", customer: null })} className="max-w-full rounded-xl"><UserRoundPlus /> Nuevo cliente</Button></div>
      {displayed.length ? <>
        <div className="hidden overflow-x-auto rounded-[1.6rem] bg-white shadow-sm xl:block">
          <table aria-label="Listado de clientes" className="w-full text-sm"><thead className="border-b border-black/5 bg-[#f8f7f4] text-left text-xs text-muted-foreground"><tr><th className="px-5 py-3.5">Cliente</th><th className="px-5 py-3.5">Contacto</th><th className="px-5 py-3.5">Visitas</th><th className="px-5 py-3.5">Última visita</th><th className="px-5 py-3.5">Desde</th><th><span className="sr-only">Acciones</span></th></tr></thead>          <tbody>{displayed.map((customer) => { const lastVisit = formatLastVisit(customer.lastVisitBusinessDate ?? null, today); return <tr key={customer.id} className="border-b border-black/5 last:border-0 hover:bg-[#f6f5f2]"><td className="px-5 py-4 font-semibold">{customer.firstName} {customer.lastName}{customer.fixedSchedule && <span className="mt-1 block text-xs font-normal text-primary">{formatFixedSchedule(customer.fixedSchedule)}</span>}</td><td className="px-5 py-4">{customer.email && <a href={`mailto:${customer.email}`} className="block hover:text-primary">{customer.email}</a>}<a href={`tel:${customer.phone}`} className="text-xs text-muted-foreground hover:text-primary">{customer.phone}</a></td><td className="px-5 py-4">{visitsButton(customer)}</td><td className="px-5 py-4 text-muted-foreground"><span className="block text-sm text-foreground">{lastVisit.dateLabel}</span>{lastVisit.relativeLabel && <span className="block text-xs">{lastVisit.relativeLabel}</span>}</td><td className="px-5 py-4 text-muted-foreground">{formatDate(customer.createdAt)}</td><td className="px-3"><div className="flex flex-wrap items-center justify-end gap-1">{payMonthButton(customer)}{editButton(customer)}{deleteButton(customer)}</div></td></tr>;})}</tbody></table>
        </div>
        <ul aria-label="Listado móvil de clientes" className="space-y-3 xl:hidden">{displayed.map((customer) => { const lastVisit = formatLastVisit(customer.lastVisitBusinessDate ?? null, today); return <li key={customer.id} className="rounded-[1.35rem] bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{customer.firstName} {customer.lastName}</p><p className="mt-1 text-xs text-muted-foreground">{visitsButton(customer)} · {lastVisit.dateLabel}{lastVisit.relativeLabel ? ` · ${lastVisit.relativeLabel}` : ""}</p>{customer.fixedSchedule && <p className="mt-1 text-xs font-medium text-primary">{formatFixedSchedule(customer.fixedSchedule)}</p>}</div><div className="flex">{editButton(customer)}{deleteButton(customer)}</div></div><div className="mt-4 flex flex-wrap gap-2">{payMonthButton(customer)}<Button nativeButton={false} render={<a href={`tel:${customer.phone}`} />} variant="outline" size="sm" className="rounded-xl"><Phone /> Llamar</Button>{customer.email && <Button nativeButton={false} render={<a href={`mailto:${customer.email}`} />} variant="outline" size="sm" className="rounded-xl"><Mail /> Email</Button>}</div></li>;})}</ul>
      </> : <div className="flex min-h-64 flex-col items-center justify-center rounded-[1.6rem] bg-white text-center shadow-sm"><UsersRound className="size-8 text-primary" /><h3 className="mt-3 font-semibold">No encontramos clientes</h3><p className="text-sm text-muted-foreground">Probá con otra búsqueda.</p></div>}
    </section>

    {editor && <CustomerEditorDialog key={`${editor.mode}-${editor.customer?.id ?? "new"}`} mode={editor.mode} customer={editor.customer} customers={customers} currentUserRole={currentUserRole} availableProfessionals={availableProfessionals} onClose={() => setEditor(null)} onSave={save} />}
    {deleting && <CustomerDeleteDialog customer={deleting} onClose={() => setDeleting(null)} onConfirm={async () => { await customerClient.remove(deleting.id); setCustomers((current) => current.filter(({ id }) => id !== deleting.id)); setDeleting(null); toast.success("Cliente eliminado correctamente."); }} />}
    {visiting && <CustomerVisitsDialog key={visiting.id} customer={visiting} onClose={() => setVisiting(null)} client={customerClient} />}
  </div>;
};
