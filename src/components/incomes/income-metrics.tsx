import {
  Banknote,
  CircleDollarSign,
  CreditCard,
  ReceiptText,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { formatArs } from "@/lib/incomes/income-calculations";
import type { IncomeListMetrics } from "@/types/income";

type IncomeMetricsProps = {
  metrics: IncomeListMetrics;
};

export const IncomeMetrics = ({ metrics }: IncomeMetricsProps) => {
  const cashPercentage =
    metrics.total > 0
      ? Math.round((metrics.cashTotal / metrics.total) * 100)
      : 0;
  const transferPercentage =
    metrics.total > 0
      ? Math.round((metrics.transferTotal / metrics.total) * 100)
      : 0;

  const items = [
    {
      label: "Total facturado",
      value: formatArs(metrics.total),
      detail: "Ingresos activos",
      icon: CircleDollarSign,
      tone: "bg-[#202023] text-white",
    },
    {
      label: "Ventas",
      value: String(metrics.count),
      detail: "Movimientos registrados",
      icon: ReceiptText,
      tone: "bg-primary text-primary-foreground",
    },
    {
      label: "Promedio por venta",
      value: formatArs(metrics.average),
      detail: "Sobre ventas activas",
      icon: Banknote,
      tone: "bg-white text-foreground",
    },
    {
      label: "Medios de pago",
      value: `${cashPercentage}% efectivo`,
      detail: `${transferPercentage}% transferencia`,
      icon: CreditCard,
      tone: "bg-[#d9d7d2] text-foreground",
    },
  ];

  return (
    <section
      aria-label="Resumen de ingresos"
      className="grid grid-cols-2 gap-3 xl:grid-cols-4"
    >
      {items.map((item) => (
        <Card
          key={item.label}
          className={`min-h-36 rounded-[1.5rem] border-0 py-0 shadow-sm ring-0 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${item.tone}`}
        >
          <CardContent className="flex h-full flex-col justify-between gap-6 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs font-medium opacity-65">{item.label}</p>
              <span className="flex size-8 items-center justify-center rounded-full bg-current/5">
                <item.icon className="size-4" />
              </span>
            </div>
            <div>
              <p className="text-xl font-semibold tracking-tight sm:text-2xl">
                {item.value}
              </p>
              <p className="mt-1 text-[11px] opacity-55">{item.detail}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </section>
  );
};
