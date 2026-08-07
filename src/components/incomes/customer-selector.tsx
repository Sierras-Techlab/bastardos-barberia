"use client";

import { Search, UserRound, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Customer } from "@/types/income";

type CustomerSelectorProps = {
  id?: string;
  customers: Customer[];
  value: string | null;
  onChange: (customerId: string | null) => void;
};

const customerName = (customer: Customer) =>
  `${customer.firstName} ${customer.lastName}`;

export const CustomerSelector = ({
  id,
  customers,
  value,
  onChange,
}: CustomerSelectorProps) => {
  const [query, setQuery] = useState("");
  const selectedCustomer = customers.find((customer) => customer.id === value);
  const filteredCustomers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es");

    if (!normalizedQuery) {
      return customers.slice(0, 5);
    }

    return customers.filter((customer) =>
      customerName(customer)
        .toLocaleLowerCase("es")
        .includes(normalizedQuery),
    );
  }, [customers, query]);

  if (selectedCustomer) {
    return (
      <div className="flex h-11 items-center gap-3 rounded-xl border border-black/5 bg-[#f6f5f2] px-3">
        <UserRound className="size-4 text-primary" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {customerName(selectedCustomer)}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Quitar cliente"
          onClick={() => {
            onChange(null);
            setQuery("");
          }}
        >
          <X />
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-3.5 left-3 z-10 size-4 text-muted-foreground" />
      <Input
        id={id}
        type="search"
        role="combobox"
        aria-label="Cliente opcional"
        aria-expanded={query.length > 0}
        aria-controls="customer-results"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Sin cliente · buscar por nombre"
        className="h-11 rounded-xl border-black/10 bg-[#f6f5f2] pr-3 pl-10 shadow-none"
      />

      {query.length > 0 && (
        <div
          id="customer-results"
          className="absolute top-[calc(100%+0.4rem)] right-0 left-0 z-30 max-h-52 overflow-y-auto rounded-xl border border-black/5 bg-white p-1.5 shadow-xl"
        >
          {filteredCustomers.length > 0 ? (
            filteredCustomers.map((customer) => (
              <button
                key={customer.id}
                type="button"
                aria-label={`Seleccionar ${customerName(customer)}`}
                onClick={() => {
                  onChange(customer.id);
                  setQuery("");
                }}
                className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm transition-colors hover:bg-[#f6f5f2] focus-visible:bg-[#f6f5f2] focus-visible:outline-none"
              >
                <UserRound className="size-4 text-primary" />
                {customerName(customer)}
              </button>
            ))
          ) : (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
              No encontramos clientes con ese nombre.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
