import { LayoutDashboard, Package, ReceiptText, Scissors, Users } from "lucide-react";
import Link from "next/link";

const links = [
  { href: "/", label: "Inicio", Icon: LayoutDashboard },
  { href: "/incomes", label: "Ingresos", Icon: ReceiptText },
  { href: "/customers", label: "Clientes", Icon: Users },
  { href: "/services", label: "Servicios", Icon: Scissors },
  { href: "/products", label: "Productos", Icon: Package },
] as const;

export function DashboardMobileNav() {
  return (
    <nav aria-label="Operación móvil" className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-border bg-card px-2 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] lg:hidden dark:bg-[#131318]">
      {links.map(({ href, label, Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={href === "/" ? "page" : undefined}
          className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg text-center text-[10px] leading-tight font-semibold text-muted-foreground outline-none aria-[current=page]:text-brand-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Icon aria-hidden="true" className="size-4" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
