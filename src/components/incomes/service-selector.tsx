import { Check, Scissors } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatArs } from "@/lib/incomes/income-calculations";
import type { Service } from "@/types/income";

type ServiceSelectorProps = {
  services: Service[];
  value: string | null;
  onChange: (serviceId: string | null) => void;
  error?: string;
};

export const ServiceSelector = ({
  services,
  value,
  onChange,
  error,
}: ServiceSelectorProps) => (
  <div className="space-y-3">
    <div className="grid gap-3 md:grid-cols-3">
      {services.map((service) => {
        const isSelected = value === service.id;

        return (
          <button
            key={service.id}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onChange(isSelected ? null : service.id)}
            className={cn(
              "group flex min-h-36 cursor-pointer flex-col justify-between rounded-2xl border-0 p-4 text-left shadow-none ring-1 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              isSelected
                ? "bg-[#202023] text-white ring-[#202023]"
                : "bg-[#f6f5f2] ring-black/5 hover:bg-white",
            )}
          >
            <span className="flex items-start justify-between gap-3">
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-full",
                  isSelected ? "bg-primary" : "bg-white text-primary",
                )}
              >
                <Scissors className="size-4" />
              </span>
              {isSelected && (
                <span className="flex size-7 items-center justify-center rounded-full bg-white text-[#202023]">
                  <Check className="size-4" />
                </span>
              )}
            </span>
            <span>
              <span className="block text-sm font-semibold leading-tight">
                {service.name}
              </span>
              <span
                className={cn(
                  "mt-2 block text-lg font-semibold",
                  isSelected ? "text-white" : "text-primary",
                )}
              >
                {formatArs(service.price)}
              </span>
            </span>
          </button>
        );
      })}
    </div>
    {error && <p className="text-sm font-medium text-destructive">{error}</p>}
  </div>
);
