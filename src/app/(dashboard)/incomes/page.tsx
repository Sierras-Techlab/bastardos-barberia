import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { IncomesView } from "@/components/incomes/incomes-view";
import { buttonVariants } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { requirePageUser } from "@/lib/auth/authorization";
import { MANAGER_ROLES } from "@/lib/auth/constants";
import { listIncomes } from "@/lib/incomes/service";
import { userRepository } from "@/lib/users/repository";
import type { Employee, IncomeListQuery } from "@/types/income";

export const metadata: Metadata = { title: "Ingresos", description: "Consultá el historial de ventas de Bastardos Barbería." };
export const getBuenosAiresMonthRange = (now = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit" }).formatToParts(now);
  const year = Number(parts.find(({ type }) => type === "year")?.value); const month = Number(parts.find(({ type }) => type === "month")?.value); const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { dateFrom: `${year}-${String(month).padStart(2, "0")}-01`, dateTo: `${year}-${String(month).padStart(2, "0")}-${lastDay}` };
};
const IncomesPage = async () => {
  const { user } = await requirePageUser(); const canViewAll = MANAGER_ROLES.has(user.role.name);
  const initialQuery: IncomeListQuery = { ...getBuenosAiresMonthRange(), page: 1, pageSize: 10 };
  const [data, users] = await Promise.all([
    listIncomes(user, initialQuery),
    canViewAll ? userRepository.list({ page: 1, pageSize: 100, status: "active" }) : Promise.resolve({ items: [user] }),
  ]);
  const employees: Employee[] = users.items.map(({ id, firstName, lastName }) => ({ id, firstName, lastName }));
  const currentUser = { id: user.id, firstName: user.firstName, lastName: user.lastName, role: user.role.name };
  return <><header className="sticky top-0 z-20 border-b border-black/5 bg-[#f1f0ed]/90 backdrop-blur-xl xl:rounded-t-[2rem]"><div className="mx-auto flex h-16 w-full max-w-[1600px] items-center justify-between gap-3 px-5 md:px-7 xl:px-8"><div className="flex min-w-0 items-center gap-3"><SidebarTrigger className="-ml-1" /><div className="min-w-0"><p className="truncate text-xs text-muted-foreground">Ventas del período</p><h1 className="truncate font-semibold">Ingresos</h1></div></div><Link href="/incomes/new" className={buttonVariants({ className: "rounded-xl" })}><Plus /><span className="hidden sm:inline">Cargar ingreso</span><span className="sm:hidden">Cargar</span></Link></div></header><main className="mx-auto w-full max-w-[1600px] flex-1 px-5 py-5 pb-10 md:px-7 xl:px-8 xl:py-7"><div className="mb-6 max-w-2xl"><p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">Libro de ventas</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">Todo lo que ingresó, en un solo lugar</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Revisá servicios y productos vendidos, filtrá movimientos y consultá el detalle de cada operación.</p></div><IncomesView data={data} initialQuery={initialQuery} currentUser={currentUser} employees={employees} canViewAll={canViewAll} canVoid={canViewAll} /></main></>;
};
export default IncomesPage;
