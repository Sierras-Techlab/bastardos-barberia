import { ChevronRight, History } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatArs } from "@/lib/incomes/income-calculations";
import type { CashHistoryItem } from "@/types/cash";

type CashHistoryTableProps = {
  items: CashHistoryItem[];
  selectedDate: string;
  loading: boolean;
  onSelect: (date: string) => void;
};

const formatDate = (date: string) =>
  new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(`${date}T12:00:00-03:00`));

export const CashHistoryTable = ({
  items,
  selectedDate,
  loading,
  onSelect,
}: CashHistoryTableProps) => (
  <section aria-labelledby="cash-history-title">
    <div className="mb-3 px-1">
      <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">Registro automático</p>
      <h3 id="cash-history-title" className="mt-1 text-lg font-semibold">Historial de cajas</h3>
      <p className="mt-1 text-sm text-muted-foreground">Solo se guardan días con actividad.</p>
    </div>

    {items.length > 0 ? (
      <>
        <div className="hidden overflow-x-auto rounded-[1.5rem] bg-white shadow-sm ring-1 ring-black/5 xl:block">
          <table aria-label="Historial de cajas" className="w-full min-w-[44rem] text-left text-sm">
            <thead className="border-b border-black/5 bg-[#f8f7f4] text-xs text-muted-foreground">
              <tr><th className="px-5 py-3 font-medium">Fecha</th><th className="px-5 py-3 font-medium">Estado</th><th className="px-5 py-3 text-right font-medium">Ventas</th><th className="px-5 py-3 text-right font-medium">Neto barbería</th><th className="w-14 px-3 py-3"><span className="sr-only">Abrir</span></th></tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {items.map((item) => (
                <tr key={item.id} className={selectedDate === item.businessDate ? "bg-primary/5" : "transition-colors hover:bg-[#faf9f6]"}>
                  <td className="px-5 py-3.5 font-medium">{formatDate(item.businessDate)}</td>
                  <td className="px-5 py-3.5"><Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Cierre guardado</Badge></td>
                  <td className="px-5 py-3.5 text-right">{formatArs(item.summary.grossTotal)}</td>
                  <td className="px-5 py-3.5 text-right font-semibold">{formatArs(item.summary.barbershopNet)}</td>
                  <td className="px-3 py-3.5"><Button type="button" variant="ghost" size="icon" disabled={loading} aria-label={`Ver caja del ${formatDate(item.businessDate)}`} onClick={() => onSelect(item.businessDate)}><ChevronRight /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul aria-label="Historial de cajas en móvil" className="space-y-3 xl:hidden">
          {items.map((item) => (
            <li key={item.id}>
              <button type="button" disabled={loading} onClick={() => onSelect(item.businessDate)} className={`w-full rounded-[1.4rem] p-4 text-left shadow-sm ring-1 ring-black/5 transition ${selectedDate === item.businessDate ? "bg-primary/5 ring-primary/20" : "bg-white"}`}>
                <span className="flex items-center justify-between gap-3"><span className="font-semibold">{formatDate(item.businessDate)}</span><ChevronRight className="size-4 text-muted-foreground" /></span>
                <span className="mt-3 grid grid-cols-2 gap-3 text-sm"><span><span className="block text-xs text-muted-foreground">Ventas</span>{formatArs(item.summary.grossTotal)}</span><span><span className="block text-xs text-muted-foreground">Neto</span>{formatArs(item.summary.barbershopNet)}</span></span>
              </button>
            </li>
          ))}
        </ul>
      </>
    ) : (
      <div className="flex min-h-40 flex-col items-center justify-center rounded-[1.5rem] bg-white px-6 text-center shadow-sm ring-1 ring-black/5">
        <History className="size-5 text-muted-foreground/55" />
        <p className="mt-3 font-semibold">Aún no hay cierres históricos</p>
        <p className="mt-1 text-sm text-muted-foreground">El primer cierre se guardará después de un día con ventas.</p>
      </div>
    )}
  </section>
);
