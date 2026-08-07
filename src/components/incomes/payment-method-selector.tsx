import { Banknote, Landmark } from "lucide-react";

import { cn } from "@/lib/utils";
import type { PaymentMethod } from "@/types/income";

type PaymentMethodSelectorProps = {
  value: PaymentMethod | null;
  onChange: (paymentMethod: PaymentMethod) => void;
  error?: string;
};

const paymentMethods = [
  { value: "cash" as const, label: "Efectivo", icon: Banknote },
  { value: "transfer" as const, label: "Transferencia", icon: Landmark },
];

export const PaymentMethodSelector = ({
  value,
  onChange,
  error,
}: PaymentMethodSelectorProps) => (
  <div className="space-y-3">
    <div className="grid grid-cols-2 gap-3">
      {paymentMethods.map((method) => {
        const isSelected = value === method.value;

        return (
          <button
            key={method.value}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onChange(method.value)}
            className={cn(
              "flex min-h-24 flex-col items-start justify-between rounded-2xl p-4 text-left ring-1 transition-all hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              isSelected
                ? "bg-primary text-primary-foreground ring-primary shadow-lg"
                : "bg-[#f6f5f2] ring-black/5 hover:bg-white hover:shadow-md",
            )}
          >
            <method.icon className="size-5" />
            <span className="text-sm font-semibold">{method.label}</span>
          </button>
        );
      })}
    </div>
    {error && <p className="text-sm font-medium text-destructive">{error}</p>}
  </div>
);
