import { BadgeDollarSign, Scissors, Tags } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { formatArs } from "@/lib/incomes/income-calculations";
import type { ServiceCatalogMetrics } from "@/types/service-catalog";

export const ServiceMetrics = ({ metrics }: { metrics: ServiceCatalogMetrics }) => {
  const items = [
    { label: "Disponibles", value: `${metrics.activeServices} activos`, detail: "Servicios para vender", icon: Scissors, tone: "bg-[#202023] text-white" },
    { label: "Precio promedio", value: formatArs(metrics.averagePrice), detail: "Valor actual", icon: BadgeDollarSign, tone: "bg-primary text-white" },
    { label: "Rango de precios", value: `${formatArs(metrics.minimumPrice)} — ${formatArs(metrics.maximumPrice)}`, detail: "De menor a mayor", icon: Tags, tone: "bg-white" },
  ];
  return (
    <section aria-label="Resumen de servicios" className="grid gap-3 sm:grid-cols-3">
      {items.map((item) => <Card key={item.label} className={`min-h-32 rounded-[1.5rem] border-0 py-0 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${item.tone}`}><CardContent className="flex h-full items-end justify-between gap-3 p-5"><div><p className="text-xs opacity-65">{item.label}</p><p className="mt-4 text-xl font-semibold tracking-tight">{item.value}</p><p className="mt-1 text-[11px] opacity-55">{item.detail}</p></div><item.icon className="size-5 shrink-0 opacity-60" /></CardContent></Card>)}
    </section>
  );
};
