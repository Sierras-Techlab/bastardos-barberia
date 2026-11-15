import { BadgeDollarSign, BookOpenText, PackageSearch, UsersRound, type LucideIcon } from "lucide-react";
import Link from "next/link";

type LinkAction = { label: string; href: "/incomes/new" | "/incomes" | "/customers" | "/products"; icon: LucideIcon; primary?: boolean };

const linkActions: LinkAction[] = [
  { label: "Cargar ingreso", href: "/incomes/new", icon: BadgeDollarSign, primary: true },
  { label: "Ver ingresos", href: "/incomes", icon: BookOpenText },
  { label: "Gestionar clientes", href: "/customers", icon: UsersRound },
  { label: "Ver productos", href: "/products", icon: PackageSearch },
];

const actionClassName = "group flex min-h-20 flex-col items-start justify-between rounded-2xl border p-3 text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:min-h-24";

export const QuickActionsCard = ({ canCreateIncome = true }: { canCreateIncome?: boolean }) => <section aria-labelledby="quick-actions-title" className="h-fit rounded-3xl border border-white/10 bg-[#202023] p-4 text-white shadow-[0_20px_55px_-38px_rgba(0,0,0,0.5)] sm:p-5">
  <div>
    <p className="text-xs font-semibold tracking-[0.16em] text-red-400 uppercase">Atajos</p>
    <h2 id="quick-actions-title" className="mt-1 text-lg font-semibold">Acciones rápidas</h2>
    <p className="mt-1 text-sm text-white/65">Las tareas que más usás</p>
  </div>
  {!canCreateIncome && <p role="status" className="mt-4 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/75">Caja de hoy está cerrada. No se pueden cargar nuevos ingresos.</p>}
  <div className="mt-4 grid grid-cols-2 gap-3">
    {linkActions.filter((action) => canCreateIncome || action.href !== "/incomes/new").map((action) => <Link key={action.href} href={action.href} className={`${actionClassName} ${action.primary ? "border-white/15 bg-primary text-white hover:bg-primary/90" : "border-white/10 bg-white/10 text-white hover:bg-white/15"}`}>
      <action.icon className="size-4 transition-transform group-hover:scale-110" />
      <span>{action.label}</span>
    </Link>)}
  </div>
</section>;
