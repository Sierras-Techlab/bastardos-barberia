import { Armchair, Ban, CalendarDays, Layers, Package, ReceiptText, Scissors, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getIncomeKindLabel } from "@/lib/incomes/income-presentation";
import type { IncomeListRow } from "@/types/income";

const kindBadgeClasses: Record<string, string> = {
  "Venta de servicio": "border-primary/20 bg-primary/10 text-brand-foreground dark:border-accent dark:bg-accent dark:text-accent-foreground",
  "Venta de productos": "border-info bg-info text-info-foreground",
  "Venta combinada": "border-accent bg-accent text-accent-foreground",
  Mensualidad: "border-success bg-success text-success-foreground",
  Suscripción: "border-success bg-success text-success-foreground",
  "Alquiler de silla": "border-warning bg-warning text-warning-foreground",
};

const kindIcons: Record<string, LucideIcon> = {
  "Venta de servicio": Scissors,
  "Venta de productos": Package,
  "Venta combinada": Layers,
  Mensualidad: CalendarDays,
  Suscripción: CalendarDays,
  "Alquiler de silla": Armchair,
};

export const IncomeTags = ({ income, className = "" }: { income: IncomeListRow; className?: string }) => {
  const kind = getIncomeKindLabel(income);
  const KindIcon = kindIcons[kind] ?? ReceiptText;

  return (
    <div role="group" className={`flex flex-wrap items-center gap-1.5 ${className}`} aria-label="Tipo y estado del ingreso">
      <Badge variant="outline" className={`h-6 max-w-full text-[10px] ${kindBadgeClasses[kind] ?? "border-border bg-muted text-muted-foreground"}`}>
        <KindIcon aria-hidden="true" data-icon="inline-start" />
        {kind}
      </Badge>
      {income.status === "voided" && (
        <Badge variant="destructive" className="h-6 text-[10px]">
          <Ban aria-hidden="true" data-icon="inline-start" />
          Anulado
        </Badge>
      )}
    </div>
  );
};
