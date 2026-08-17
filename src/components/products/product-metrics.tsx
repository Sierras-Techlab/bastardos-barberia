import { Boxes, Package, Tags, TriangleAlert } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { formatArs } from "@/lib/incomes/income-calculations";
import type { ProductCatalogMetrics } from "@/types/product";

type ProductMetricsProps = {
  metrics: ProductCatalogMetrics;
};

export const ProductMetrics = ({ metrics }: ProductMetricsProps) => {
  const items = [
    {
      label: "Productos",
      value: String(metrics.totalProducts),
      detail: `${metrics.categoryCount} categorías`,
      icon: Package,
      tone: "bg-[#202023] text-white",
    },
    {
      label: "Unidades en stock",
      value: String(metrics.totalUnits),
      detail: "Entre todos los productos",
      icon: Boxes,
      tone: "bg-primary text-primary-foreground",
    },
    {
      label: "Reponer pronto",
      value: String(metrics.lowStockProducts),
      detail: `${metrics.outOfStockProducts} sin stock`,
      icon: TriangleAlert,
      tone: "bg-white text-foreground",
    },
    {
      label: "Precio promedio",
      value: formatArs(metrics.averagePrice),
      detail: "Precio actual de venta",
      icon: Tags,
      tone: "bg-[#d9d7d2] text-foreground",
    },
  ];

  return (
    <section
      aria-label="Resumen de productos"
      className="grid grid-cols-2 gap-3 xl:grid-cols-4"
    >
      {items.map((item) => (
        <Card
          key={item.label}
          className={`min-h-32 rounded-[1.5rem] border-0 py-0 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${item.tone}`}
        >
          <CardContent className="flex h-full items-end justify-between gap-4 p-4 sm:p-5">
            <div>
              <p className="text-xs font-medium opacity-65">{item.label}</p>
              <p className="mt-4 text-2xl font-semibold tracking-tight">
                {item.value}
              </p>
              <p className="mt-1 text-[11px] opacity-55">{item.detail}</p>
            </div>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-current/10">
              <item.icon className="size-4" />
            </span>
          </CardContent>
        </Card>
      ))}
    </section>
  );
};
