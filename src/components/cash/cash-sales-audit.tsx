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

const kindLabels: Record<"service" | "products" | "combined" | "subscription" | "chair_rental", string> = {
  service: "Servicio",
  products: "Productos",
  combined: "Combinada",
  subscription: "Mensualidad",
  chair_rental: "Alquiler de silla",
};

const isExcludedFromSelectedDay = (sale: CashSaleAuditItem) =>
  sale.statusAtClose === "voided";

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
        <div className="hidden overflow-x-auto rounded-[1.5rem] bg-white shadow-sm ring-1 ring-black/5 xl:block">
          <table aria-label="Ventas de la caja" className="w-full min-w-[44rem] text-left text-sm">
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
              {sales.map((sale) => {
                const excluded = isExcludedFromSelectedDay(sale);

                return (
                  <tr
                    key={sale.id}
                    className={`transition-colors hover:bg-[#faf9f6] ${sale.currentStatus === "voided" ? "bg-red-50/45" : ""}`}
                  >
                    <td className="px-5 py-3.5 text-muted-foreground">
                      {formatTime(sale.createdAt)}
                    </td>
                    <td className="px-5 py-3.5 font-medium">
                      {sale.employee.firstName} {sale.employee.lastName}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{kindLabels[sale.kind]}</Badge>
                        {sale.currentStatus === "voided" && (
                          <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
                            Anulada
                          </Badge>
                        )}
                        {excluded && <Badge variant="secondary">Excluida del neto</Badge>}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right font-medium">
                      {formatArs(excluded ? 0 : sale.grossTotal)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-medium">
                      {formatArs(excluded ? 0 : sale.barbershopNet)}
                    </td>
                    <td className="px-3 py-3.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Ver detalle de venta de ${sale.employee.firstName}`}
                        onClick={() => onSelect(sale)}
                      >
                        <Eye />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <ul aria-label="Ventas de la caja en móvil" className="space-y-3 xl:hidden">
          {sales.map((sale) => {
            const excluded = isExcludedFromSelectedDay(sale);

            return (
              <li
                key={sale.id}
                className="rounded-[1.4rem] bg-white p-4 shadow-sm ring-1 ring-black/5"
              >
                <button type="button" className="w-full text-left" onClick={() => onSelect(sale)}>
                  <span className="flex items-start justify-between gap-3">
                    <span>
                      <span className="block font-semibold">
                        {sale.employee.firstName} {sale.employee.lastName}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                        {formatTime(sale.createdAt)} · {kindLabels[sale.kind]}
                        {sale.currentStatus === "voided" && (
                          <span className="font-medium text-red-600">· Anulada</span>
                        )}
                        {excluded && (
                          <span className="font-medium text-muted-foreground">· Excluida del neto</span>
                        )}
                      </span>
                    </span>
                    <span className="font-semibold">
                      {formatArs(excluded ? 0 : sale.grossTotal)}
                    </span>
                  </span>
                  <span className="mt-3 flex items-center justify-between border-t border-black/5 pt-3 text-xs text-muted-foreground">
                    <span>Neto {formatArs(excluded ? 0 : sale.barbershopNet)}</span>
                    <span className="flex items-center gap-1 text-primary">
                      <Eye className="size-3.5" /> Ver detalle
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
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
