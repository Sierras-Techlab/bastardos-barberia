import { DollarSign, Package, ReceiptText, Users } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

const actions = [
  { label: "Cargar ingreso", href: "/incomes/new", icon: DollarSign, primary: true },
  { label: "Ver ingresos", href: "/incomes", icon: ReceiptText },
  { label: "Gestionar clientes", href: "/customers", icon: Users },
  { label: "Ver productos", href: "/products", icon: Package },
] as const;

export function QuickActionsCard({ canCreateIncome = true }: { canCreateIncome?: boolean }) {
  return (
    <nav aria-label="Accesos directos" className="mx-auto w-full max-w-sm lg:mr-0 lg:w-auto">
      <div className="flex justify-center gap-1 sm:gap-3 lg:justify-end xl:gap-4">
        {actions.filter((action) => canCreateIncome || action.href !== "/incomes/new").map((action) => {
          const Icon = action.icon;
          const primary = action.href === "/incomes/new";
          return (
            <Link
              key={action.href}
              href={action.href}
              className="group flex min-h-19 w-[4.15rem] shrink-0 flex-col items-center gap-2 rounded-xl py-1 text-center text-[11px] leading-tight font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-[4.5rem]"
            >
              <span
                className={cn(
                  "grid size-12 shrink-0 place-items-center rounded-full border transition-transform group-hover:-translate-y-0.5 motion-reduce:transform-none",
                  primary
                    ? "border-transparent bg-[#dc2626] text-white shadow-[0_4px_13px_#dc26265c] ring-2 ring-[#dc2626]/20"
                    : "border-transparent bg-[#111113] text-white dark:border-white/10 dark:bg-[#1e1e26]",
                )}
              >
                <Icon aria-hidden="true" className="size-5" />
              </span>
              <span>{action.label}</span>
            </Link>
          );
        })}
      </div>
      {!canCreateIncome && (
        <p role="status" className="mt-2 rounded-xl bg-warning px-3 py-2 text-center text-xs font-medium text-warning-foreground lg:text-right">
          La Caja de hoy está cerrada. No se pueden cargar nuevos ingresos.
        </p>
      )}
    </nav>
  );
}
