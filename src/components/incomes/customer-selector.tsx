"use client";

import { Plus, Search, UserRound, X } from "lucide-react";
import { useMemo, useState } from "react";
import { CustomerEditorDialog } from "@/components/customers/customer-editor-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CustomerApiError, customerClient as defaultCustomerClient, type CustomerClient } from "@/lib/customers/client";
import type { FrontendCustomerEditorInput } from "@/lib/customers/frontend-customer-contracts";
import type { Customer as StoredCustomer } from "@/types/customer";
import type { Customer } from "@/types/income";

type Props = { id?: string; customers: Customer[]; value: string | null; onChange(customerId: string | null): void; onCustomerCreated?(customer: StoredCustomer): void; customerClient?: Pick<CustomerClient, "create"> };
const name = (customer: Customer) => `${customer.firstName} ${customer.lastName}`;
const digits = (value: string) => value.replace(/\D/g, "");
const asStored = (customer: Customer): StoredCustomer => ({ id: customer.id, firstName: customer.firstName, lastName: customer.lastName, phone: customer.phone ?? "", email: null, visits: 0, createdAt: new Date(0).toISOString() });

export const CustomerSelector = ({ id, customers, value, onChange, onCustomerCreated, customerClient = defaultCustomerClient }: Props) => {
  const [query, setQuery] = useState(""); const [creating, setCreating] = useState(false); const [duplicate, setDuplicate] = useState<Customer | null>(null);
  const selected = customers.find((customer) => customer.id === value);
  const filtered = useMemo(() => { const text = query.trim().toLocaleLowerCase("es-AR"); const phone = digits(query); return customers.filter((customer) => name(customer).toLocaleLowerCase("es-AR").includes(text) || (phone && digits(customer.phone ?? "").includes(phone))).slice(0, 5); }, [customers, query]);
  const save = async (input: FrontendCustomerEditorInput) => {
    try { const created = await customerClient.create(input); onCustomerCreated?.(created); setCreating(false); setQuery(""); return created; }
    catch (error) { if (error instanceof CustomerApiError && error.code === "CUSTOMER_PHONE_EXISTS") setDuplicate(customers.find((customer) => digits(customer.phone ?? "") === digits(input.phone)) ?? null); throw error; }
  };

  if (selected) return <div className="flex h-11 items-center gap-3 rounded-xl border border-black/5 bg-[#f6f5f2] px-3"><UserRound className="size-4 text-primary" /><span className="min-w-0 flex-1 truncate text-sm font-medium">{name(selected)}</span><Button type="button" variant="ghost" size="icon-sm" aria-label="Quitar cliente" onClick={() => { onChange(null); setQuery(""); }}><X /></Button></div>;

  return <div className="relative"><Search className="pointer-events-none absolute top-3.5 left-3 z-10 size-4 text-muted-foreground" /><Input id={id} type="search" role="combobox" aria-label="Cliente opcional" aria-expanded={query.length > 0} aria-controls="customer-results" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Sin cliente · nombre o teléfono" className="h-11 rounded-xl border-black/10 bg-[#f6f5f2] pr-3 pl-10 shadow-none" />
    {query.length > 0 && <div id="customer-results" className="absolute top-[calc(100%+0.4rem)] right-0 left-0 z-30 max-h-60 overflow-y-auto rounded-xl border border-black/5 bg-white p-1.5 shadow-xl">{filtered.map((customer) => <button key={customer.id} type="button" aria-label={`Seleccionar ${name(customer)}`} onClick={() => { onChange(customer.id); setQuery(""); }} className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm hover:bg-[#f6f5f2]"><UserRound className="size-4 text-primary" />{name(customer)}</button>)}{filtered.length === 0 && <p className="px-3 py-2 text-center text-xs text-muted-foreground">No encontramos ese cliente.</p>}<button type="button" onClick={() => setCreating(true)} className="mt-1 flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-medium text-primary hover:bg-red-50"><Plus className="size-4" /> Crear cliente</button></div>}
    {duplicate && <button type="button" onClick={() => { onChange(duplicate.id); setCreating(false); setDuplicate(null); setQuery(""); }} className="mt-2 text-xs font-medium text-primary">Usar cliente existente: {name(duplicate)}</button>}
    {creating && <CustomerEditorDialog mode="create" customer={null} customers={customers.map(asStored)} onClose={() => { setCreating(false); setDuplicate(null); }} onSave={save} />}
  </div>;
};
