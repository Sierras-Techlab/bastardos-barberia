"use client";

import { Mail, Pencil, Phone, RotateCcw, Search, UserRoundPlus, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { CustomerEditorDialog } from "@/components/customers/customer-editor-dialog";
import { ProductActionFeedback } from "@/components/products/product-action-feedback";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { calculateCustomerMetrics, filterCustomers, sortCustomers } from "@/lib/customers/customer-catalog";
import type { Customer, CustomerCatalogData, CustomerEditorInput, CustomerSort } from "@/types/customer";

type CustomersViewProps = { data: CustomerCatalogData; canManage: boolean };
const formatDate = (value: string) => new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value));

export const CustomersView = ({ data, canManage }: CustomersViewProps) => {
  const [customers, setCustomers] = useState(() => data.customers);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<CustomerSort>("original");
  const [editor, setEditor] = useState<{ mode: "create" | "edit"; customer: Customer | null } | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const displayed = useMemo(() => sortCustomers(filterCustomers(customers, query), sort), [customers, query, sort]);
  const metrics = useMemo(() => calculateCustomerMetrics(customers), [customers]);

  useEffect(() => {
    if (!feedback) return;
    const timeout = window.setTimeout(() => setFeedback(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  const save = (input: CustomerEditorInput) => {
    if (editor?.mode === "edit" && editor.customer) {
      setCustomers((current) => current.map((customer) => customer.id === editor.customer?.id ? { ...customer, ...input } : customer));
      setFeedback("Cliente actualizado correctamente.");
    } else {
      setCustomers((current) => [...current, { ...input, id: `mock-customer-${current.length + 1}`, visits: 0, createdAt: new Date().toISOString() }]);
      setFeedback("Cliente añadido correctamente.");
    }
    setEditor(null);
  };

  return (
    <div className="space-y-5">
      <section aria-label="Resumen de clientes" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          ["Clientes", metrics.totalCustomers, "Base registrada"],
          ["Nuevos", metrics.newCustomers, "Último período"],
          ["Visitas", metrics.totalVisits, "Ingresos asociados"],
        ].map(([label, value, detail], index) => (
          <Card key={String(label)} className={`min-h-32 rounded-[1.5rem] border-0 py-0 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${index === 0 ? "bg-[#202023] text-white" : index === 1 ? "bg-primary text-white" : "bg-white"}`}>
            <CardContent className="flex h-full items-end justify-between p-5"><div><p className="text-xs opacity-65">{label}</p><p className="mt-4 text-2xl font-semibold">{value}</p><p className="mt-1 text-[11px] opacity-55">{detail}</p></div><UsersRound className="size-5 opacity-60" /></CardContent>
          </Card>
        ))}
      </section>

      <section aria-label="Filtros de clientes" className="rounded-[1.4rem] bg-white p-3 shadow-sm sm:p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(16rem,1fr)_14rem_auto]">
          <div className="relative min-w-0 sm:col-span-2 lg:col-span-1"><Search className="pointer-events-none absolute top-3.5 left-3.5 size-4 text-muted-foreground" /><Input type="search" aria-label="Buscar clientes" placeholder="Nombre, email o teléfono" value={query} onChange={(event) => setQuery(event.target.value)} className="h-11 rounded-xl bg-[#f6f5f2] pl-10 shadow-none" /></div>
          <select aria-label="Ordenar clientes" value={sort} onChange={(event) => setSort(event.target.value as CustomerSort)} className="h-11 rounded-xl border border-black/10 bg-[#f6f5f2] px-3 text-sm">
            <option value="original">Orden original</option><option value="visits-desc">Más visitas</option><option value="visits-asc">Menos visitas</option><option value="newest">Más recientes</option><option value="oldest">Más antiguos</option>
          </select>
          <Button type="button" variant="ghost" disabled={!query && sort === "original"} onClick={() => { setQuery(""); setSort("original"); }} className="h-11 rounded-xl"><RotateCcw /> Limpiar</Button>
        </div>
      </section>

      <section aria-labelledby="customer-list-title">
        <div className="mb-3 flex items-end justify-between gap-3 px-1"><div><h2 id="customer-list-title" className="text-lg font-semibold">Directorio de clientes</h2><p className="text-sm text-muted-foreground">{displayed.length} clientes</p></div>{canManage && <Button onClick={() => setEditor({ mode: "create", customer: null })} className="rounded-xl"><UserRoundPlus /> Nuevo cliente</Button>}</div>
        {displayed.length ? <>
          <div className="hidden overflow-hidden rounded-[1.6rem] bg-white shadow-sm md:block"><table aria-label="Listado de clientes" className="w-full text-sm"><thead className="border-b border-black/5 bg-[#f8f7f4] text-left text-xs text-muted-foreground"><tr><th className="px-5 py-3.5">Cliente</th><th className="px-5 py-3.5">Contacto</th><th className="px-5 py-3.5">Visitas</th><th className="px-5 py-3.5">Desde</th>{canManage && <th><span className="sr-only">Acciones</span></th>}</tr></thead><tbody>{displayed.map((customer) => <tr key={customer.id} className="border-b border-black/5 last:border-0 hover:bg-[#f6f5f2]"><td className="px-5 py-4 font-semibold">{customer.firstName} {customer.lastName}</td><td className="px-5 py-4"><a href={`mailto:${customer.email}`} className="block hover:text-primary">{customer.email}</a><a href={`tel:${customer.phone}`} className="text-xs text-muted-foreground hover:text-primary">{customer.phone}</a></td><td className="px-5 py-4 font-medium">{customer.visits} {customer.visits === 1 ? "visita" : "visitas"}</td><td className="px-5 py-4 text-muted-foreground">{formatDate(customer.createdAt)}</td>{canManage && <td className="px-3"><Button variant="ghost" size="icon" aria-label={`Gestionar ${customer.firstName} ${customer.lastName}`} onClick={() => setEditor({ mode: "edit", customer })} className="rounded-xl"><Pencil /></Button></td>}</tr>)}</tbody></table></div>
          <ul aria-label="Listado móvil de clientes" className="space-y-3 md:hidden">{displayed.map((customer) => <li key={customer.id} className="rounded-[1.35rem] bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{customer.firstName} {customer.lastName}</p><p className="mt-1 text-xs text-muted-foreground">{customer.visits} {customer.visits === 1 ? "visita" : "visitas"} · desde {formatDate(customer.createdAt)}</p></div>{canManage && <Button variant="ghost" size="icon" aria-label={`Gestionar ${customer.firstName} ${customer.lastName}`} onClick={() => setEditor({ mode: "edit", customer })}><Pencil /></Button>}</div><div className="mt-4 flex flex-wrap gap-2"><Button nativeButton={false} render={<a href={`tel:${customer.phone}`} />} variant="outline" size="sm" className="rounded-xl"><Phone /> Llamar</Button><Button nativeButton={false} render={<a href={`mailto:${customer.email}`} />} variant="outline" size="sm" className="rounded-xl"><Mail /> Email</Button></div></li>)}</ul>
        </> : <div className="flex min-h-64 flex-col items-center justify-center rounded-[1.6rem] bg-white text-center shadow-sm"><UsersRound className="size-8 text-primary" /><h3 className="mt-3 font-semibold">No encontramos clientes</h3><p className="text-sm text-muted-foreground">Probá con otra búsqueda.</p></div>}
      </section>
      {editor && <CustomerEditorDialog key={`${editor.mode}-${editor.customer?.id ?? "new"}`} mode={editor.mode} customer={editor.customer} customers={customers} onClose={() => setEditor(null)} onSave={save} />}
      {feedback && <ProductActionFeedback message={feedback} onClose={() => setFeedback(null)} />}
    </div>
  );
};
