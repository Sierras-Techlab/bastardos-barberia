import { Eye, ReceiptText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatArs } from "@/lib/incomes/income-calculations";
import type { CashSaleAuditItem } from "@/types/cash";

type CashSalesAuditProps = {
  sales: CashSaleAuditItem[];
  onSelect: (sale: CashSaleAuditItem) => void;
};

const formatTime = (value: string) =>
  new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(value));

const kindLabels = {
  service: "Servicio",
  products: "Productos",
  combined: "Combinada",
} as const;

export const CashSalesAudit = ({ sales, onSelect }: CashSalesAuditProps) => (
  <section aria-labelledby="cash-sales-title">
    <div className="mb-3 flex items-end justify-between gap-4 px-1">
      <div>
        <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">
          Auditoría diaria
        </p>
        <h3 id="cash-sales-title" className="mt-1 text-lg font-semibold">
          Desglose de ventas
        </h3>
      </div>
      <p className="text-xs text-muted-foreground">
        {sales.length} {sales.length === 1 ? "movimiento" : "movimientos"}
      </p>
    </div>

    {sales.length > 0 ? (
      <>
        <div className="hidden overflow-hidden rounded-[1.5rem] bg-white shadow-sm ring-1 ring-black/5 md:block">
          <table aria-label="Ventas de la caja" className="w-full text-left text-sm">
            <thead className="border-b border-black/5 bg-[#f8f7f4] text-xs text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Hora</th>
                <th className="px-5 py-3 font-medium">Responsable</th>
                <th className="px-5 py-3 font-medium">Concepto</th>
                <th className="px-5 py-3 text-right font-medium">Bruto</th>
                <th className="px-5 py-3 text-right font-medium">Neto</th>
                <th className="w-14 px-3 py-3"><span className="sr-only">Detalle</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {sales.map((sale) => (
                <tr key={sale.id} className="transition-colors hover:bg-[#faf9f6]">
                  <td className="px-5 py-3.5 text-muted-foreground">{formatTime(sale.createdAt)}</td>
                  <td className="px-5 py-3.5 font-medium">{sale.employee.firstName} {sale.employee.lastName}</td>
                  <td className="px-5 py-3.5"><Badge variant="outline">{kindLabels[sale.kind]}</Badge></td>
                  <td className="px-5 py-3.5 text-right font-medium">{formatArs(sale.grossTotal)}</td>
                  <td className="px-5 py-3.5 text-right font-medium">{formatArs(sale.barbershopNet)}</td>
                  <td className="px-3 py-3.5">
                    <Button type="button" variant="ghost" size="icon" aria-label={`Ver detalle de venta de ${sale.employee.firstName}`} onClick={() => onSelect(sale)}><Eye /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul aria-label="Ventas de la caja en móvil" className="space-y-3 md:hidden">
          {sales.map((sale) => (
            <li key={sale.id} className="rounded-[1.4rem] bg-white p-4 shadow-sm ring-1 ring-black/5">
              <button type="button" className="w-full text-left" onClick={() => onSelect(sale)}>
                <span className="flex items-start justify-between gap-3">
                  <span>
                    <span className="block font-semibold">{sale.employee.firstName} {sale.employee.lastName}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{formatTime(sale.createdAt)} · {kindLabels[sale.kind]}</span>
                  </span>
                  <span className="font-semibold">{formatArs(sale.grossTotal)}</span>
                </span>
                <span className="mt-3 flex items-center justify-between border-t border-black/5 pt-3 text-xs text-muted-foreground">
                  <span>Neto {formatArs(sale.barbershopNet)}</span>
                  <span className="flex items-center gap-1 text-primary"><Eye className="size-3.5" /> Ver detalle</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </>
    ) : (
      <div className="flex min-h-48 flex-col items-center justify-center rounded-[1.5rem] bg-white px-6 text-center shadow-sm ring-1 ring-black/5">
        <ReceiptText className="size-5 text-primary" />
        <p className="mt-3 font-semibold">Todavía no hay ventas</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          La caja se actualiza automáticamente cuando se registra un ingreso.
        </p>
      </div>
    )}
  </section>
);

