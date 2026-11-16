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
        <p className="text-xs font-semibold tracking-[0.16em] text-brand-foreground uppercase">
          Detalle del día
        </p>
        <h3 id="cash-sales-title" className="mt-1 text-lg font-semibold">
          Movimientos del día
        </h3>
      </div>
      <p className="text-xs text-muted-foreground">
        {sales.length} {sales.length === 1 ? "movimiento" : "movimientos"}
      </p>
    </div>

    {sales.length > 0 ? (
      <>
        <div className="hidden overflow-x-auto rounded-[1.5rem] bg-card shadow-sm ring-1 ring-black/5 xl:block">
          <table aria-label="Movimientos de la caja" className="w-full min-w-[44rem] text-left text-sm">
            <thead className="border-b border-border bg-muted text-xs text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Hora</th>
                <th className="px-5 py-3 font-medium">Responsable</th>
                <th className="px-5 py-3 font-medium">Concepto</th>
                <th className="px-5 py-3 text-right font-medium">Cobrado</th>
                <th className="px-5 py-3 text-right font-medium">Para la barbería</th>
                <th className="w-14 px-3 py-3"><span className="sr-only">Detalle</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {sales.map((sale) => {
                const excluded = isExcludedFromSelectedDay(sale);

                return (
                  <tr
                    key={sale.id}
                    className={`transition-colors hover:bg-muted ${sale.currentStatus === "voided" ? "bg-destructive/10" : ""}`}
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
                          <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/10">
                            Anulada
                          </Badge>
                        )}
                        {excluded && <Badge variant="secondary">No suma al total</Badge>}
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

        <ul aria-label="Movimientos de la caja en móvil" className="space-y-3 xl:hidden">
          {sales.map((sale) => {
            const excluded = isExcludedFromSelectedDay(sale);

            return (
              <li
                key={sale.id}
                className="rounded-[1.4rem] bg-card p-4 shadow-sm ring-1 ring-black/5"
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
                          <span className="font-medium text-destructive">· Anulada</span>
                        )}
                        {excluded && (
                          <span className="font-medium text-muted-foreground">· No suma al total</span>
                        )}
                      </span>
                    </span>
                    <span className="font-semibold">
                      {formatArs(excluded ? 0 : sale.grossTotal)}
                    </span>
                  </span>
                  <span className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                    <span>Para la barbería {formatArs(excluded ? 0 : sale.barbershopNet)}</span>
                    <span className="flex items-center gap-1 text-brand-foreground">
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
      <div className="flex min-h-48 flex-col items-center justify-center rounded-[1.5rem] bg-card px-6 text-center shadow-sm ring-1 ring-black/5">
        <ReceiptText className="size-5 text-brand-foreground" />
        <p className="mt-3 font-semibold">Todavía no hay cobros</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          La caja se actualiza automáticamente cuando se registra un ingreso.
        </p>
      </div>
    )}
  </section>
);
