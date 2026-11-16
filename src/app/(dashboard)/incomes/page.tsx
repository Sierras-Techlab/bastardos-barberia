import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { IncomesView } from "@/components/incomes/incomes-view";
import { buttonVariants } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { requirePageUser } from "@/lib/auth/authorization";
import { MANAGER_ROLES } from "@/lib/auth/constants";
import { getBuenosAiresToday } from "@/lib/cash/date";
import { isCashClosedForDate } from "@/lib/cash/repository";
import { listIncomeResponsibleEmployees, listIncomes } from "@/lib/incomes/service";
import { getBuenosAiresMonthRange } from "@/lib/incomes/date-range";
import { employeePaginatedIncomesSchema, paginatedIncomesSchema } from "@/lib/incomes/contracts";
import { withIncomeLoadDeadline } from "@/lib/incomes/load-deadline";
import { paymentMethodRepository } from "@/lib/payment-methods/repository";
import type { IncomeListQuery, PaginatedIncomes } from "@/types/income";

export const metadata: Metadata = { title: "Ingresos", description: "Consultá los cobros y comisiones de Bastardos Barbería." };
const IncomesPage = async () => {
  const { user } = await requirePageUser(); const canViewAll = MANAGER_ROLES.has(user.role.name);
  const initialQuery: IncomeListQuery = { ...getBuenosAiresMonthRange(), page: 1, pageSize: 10 };
  const [data, employees, paymentMethods, cashClosed] = await withIncomeLoadDeadline(Promise.all([
    listIncomes(user, initialQuery),
    canViewAll
      ? listIncomeResponsibleEmployees(user)
      : Promise.resolve([{ id: user.id, firstName: user.firstName, lastName: user.lastName }]),
    paymentMethodRepository.list(true),
    isCashClosedForDate(getBuenosAiresToday()),
  ]));
  const viewData: PaginatedIncomes = canViewAll
    ? (() => {
        const managerData = paginatedIncomesSchema.parse(data);
        return {
          ...managerData,
          items: managerData.items.map((income) => ({
            ...income,
            service: income.service
              ? { ...income.service, price: income.service.chargedUnitPrice }
              : null,
            products: income.products.map((product) => ({
              ...product,
              unitPrice: product.chargedUnitPrice,
            })),
          })),
        };
      })()
    : employeePaginatedIncomesSchema.parse(data);
  const currentUser = { id: user.id, firstName: user.firstName, lastName: user.lastName, role: user.role.name };
  return <><header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-xl xl:rounded-t-[2rem]"><div className="mx-auto flex min-h-16 w-full max-w-[1600px] items-center justify-between gap-3 px-5 py-2 md:px-7 xl:px-8"><div className="flex min-w-0 items-center gap-3"><SidebarTrigger className="-ml-1" /><div className="min-w-0"><p className="truncate text-xs text-muted-foreground">Ingresos del período</p><h1 className="truncate font-semibold">Ingresos</h1></div></div>{cashClosed ? <p role="status" className="max-w-52 rounded-xl border border-border bg-muted px-3 py-2 text-right text-xs leading-4 text-muted-foreground sm:max-w-none">Caja diaria cerrada · Abrila en Caja para registrar ingresos</p> : <Link href="/incomes/new" className={buttonVariants({ className: "min-h-11 rounded-xl" })}><Plus /><span className="hidden sm:inline">Cargar ingreso</span><span className="sm:hidden">Cargar</span></Link>}</div></header><main className="mx-auto w-full max-w-[1600px] flex-1 px-5 py-5 pb-10 md:px-7 xl:px-8 xl:py-7"><div className="mb-6 max-w-2xl"><p className="text-xs font-semibold tracking-[0.2em] text-brand-foreground uppercase">Ingresos del período</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">{canViewAll ? "Todo lo que ingresó, en un solo lugar" : "Tus ventas y comisiones, en un solo lugar"}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{canViewAll ? "Consultá ventas, mensualidades y alquileres de silla. Los filtros de abajo indican qué incluyen los importes." : "Revisá tus ventas y las comisiones que generaron. Los filtros de abajo indican qué incluye el resumen."}</p></div>    <IncomesView data={viewData} initialQuery={initialQuery} currentUser={currentUser} employees={employees} paymentMethods={paymentMethods} canViewAll={canViewAll} canVoid={canViewAll} /></main></>;
};
export default IncomesPage;
