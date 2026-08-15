import { BadgeDollarSign, HandCoins, Landmark } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { formatArs } from "@/lib/incomes/income-calculations";
import type { CashSummary } from "@/types/cash";

type CashSummaryCardsProps = { summary: CashSummary };

const cards = (summary: CashSummary) => [
  {
    label: "Ventas brutas",
    value: summary.grossTotal,
    note: `${summary.activeSaleCount} ${summary.activeSaleCount === 1 ? "venta activa" : "ventas activas"}`,
    icon: BadgeDollarSign,
    className: "bg-[#202023] text-white ring-0",
    mutedClassName: "text-white/55",
  },
  {
    label: "Comisiones",
    value: summary.commissionTotal,
    note: "Devengadas al equipo",
    icon: HandCoins,
    className: "bg-primary text-white ring-0",
    mutedClassName: "text-white/65",
  },
  {
    label: "Neto barbería",
    value: summary.barbershopNet,
    note: "Después de comisiones",
    icon: Landmark,
    className: "bg-white",
    mutedClassName: "text-muted-foreground",
  },
];

export const CashSummaryCards = ({ summary }: CashSummaryCardsProps) => (
  <div className="grid gap-3 sm:grid-cols-3">
    {cards(summary).map((item) => (
      <Card
        key={item.label}
        className={`${item.className} min-h-36 rounded-[1.5rem] py-0 shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md`}
      >
        <CardContent className="flex h-full flex-col justify-between p-5">
          <div className="flex items-start justify-between gap-4">
            <p className={`text-xs font-medium ${item.mutedClassName}`}>
              {item.label}
            </p>
            <span className="flex size-9 items-center justify-center rounded-full bg-current/10">
              <item.icon className="size-4" />
            </span>
          </div>
          <div>
            <p className="text-2xl font-semibold tracking-[-0.04em]">
              {formatArs(item.value)}
            </p>
            <p className={`mt-1 text-xs ${item.mutedClassName}`}>{item.note}</p>
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);
