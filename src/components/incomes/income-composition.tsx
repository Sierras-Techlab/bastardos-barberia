import { formatArs } from "@/lib/incomes/income-calculations";
import type { IncomeComposition as Composition } from "@/types/income";

const groups = [
  { key: "sales", label: "Ventas de servicios y productos" },
  { key: "subscriptions", label: "Mensualidades de clientes" },
  { key: "chairRentals", label: "Alquileres de silla" },
] as const;

export const IncomeComposition = ({ composition }: { composition: Composition }) => (
  <section aria-label="De dónde viene lo cobrado" className="rounded-2xl border border-black/8 bg-white">
    <div className="border-b border-black/5 px-4 py-3 sm:px-5">
      <h3 className="text-sm font-semibold">De dónde viene lo cobrado</h3>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">Estos conceptos ya están incluidos en el total de arriba.</p>
    </div>
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
    <p className="rounded-b-2xl bg-[#f8f7f4] px-4 py-3 text-xs leading-5 text-muted-foreground sm:px-5">El alquiler de silla se suma a los cobros y no genera comisión.</p>
  </section>
);
