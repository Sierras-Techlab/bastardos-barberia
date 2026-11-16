import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { formatArs } from "@/lib/incomes/income-calculations";
import type { IncomeComposition as Composition } from "@/types/income";

const groups = [
  { key: "sales", label: "Ventas de servicios y productos" },
  { key: "subscriptions", label: "Mensualidades de clientes" },
  { key: "chairRentals", label: "Alquileres de silla" },
] as const;

export const IncomeComposition = ({
  composition,
  children,
}: {
  composition: Composition;
  children?: ReactNode;
}) => (
  <details className="group rounded-2xl border border-border bg-card">
    <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset marker:hidden [&::-webkit-details-marker]:hidden sm:px-5">
      <span className="min-w-0">
        <span className="block text-sm font-semibold">De dónde viene lo cobrado</span>
        <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">Ventas, mensualidades y alquileres</span>
      </span>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <ChevronDown aria-hidden="true" className="size-4 transition-transform duration-200 group-open:rotate-180" />
      </span>
    </summary>

    <section aria-label="De dónde viene lo cobrado" className="border-t border-border">
      <p className="px-4 py-3 text-xs leading-5 text-muted-foreground sm:px-5">Estos conceptos ya están incluidos en el total de arriba.</p>
      <ul className="divide-y divide-black/5">
        {groups.map(({ key, label }) => {
          const amounts = composition[key];
          return (
            <li key={key} className="grid gap-3 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,1.2fr)] lg:items-center">
              <div>
                <p className="text-sm font-medium">{label}</p>
                {key === "chairRentals" && <p className="mt-1 text-xs text-muted-foreground">Sin comisión</p>}
              </div>
              <dl className="grid min-w-0 grid-cols-3 gap-2 text-right">
                {[
                  { label: "Cobrado", amount: amounts.grossTotal },
                  { label: "Comisiones", amount: amounts.commissionTotal },
                  { label: "Para la barbería", amount: amounts.barbershopNet },
                ].map((item) => (
                  <div key={item.label} className="min-w-0">
                    <dt className="text-[11px] leading-4 text-muted-foreground">{item.label}</dt>
                    <dd className="mt-1 break-words text-xs font-semibold tabular-nums sm:text-sm">{formatArs(item.amount)}</dd>
                  </div>
                ))}
              </dl>
            </li>
          );
        })}
      </ul>
      <p className="bg-muted px-4 py-3 text-xs leading-5 text-muted-foreground sm:px-5">El alquiler de silla se suma a los cobros y no genera comisión.</p>
      {children && <div className="space-y-2 border-t border-border px-4 py-3 text-xs leading-5 text-muted-foreground sm:px-5">{children}</div>}
    </section>
  </details>
);

