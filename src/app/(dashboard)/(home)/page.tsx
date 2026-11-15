import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { FixedCustomersCard } from "@/components/dashboard/fixed-customers-card";
import { IncomeSummaryCard } from "@/components/dashboard/income-summary-card";
import { BastardosWordmark } from "@/components/dashboard/bastardos-wordmark";
import { DashboardMobileNav } from "@/components/dashboard/dashboard-mobile-nav";
import { SevenDayEvolution } from "@/components/dashboard/seven-day-evolution";
import { requirePageUser } from "@/lib/auth/authorization";
import { isCashClosedForDate } from "@/lib/cash/repository";
import {
  buildIncomeSummaryForViewer,
  getBuenosAiresSevenDayRange,
} from "@/lib/dashboard/income-summary";
import { getBuenosAiresRemainingWorkweekRange } from "@/lib/dashboard/workweek-range";
import { listFixedOccurrences } from "@/lib/fixed-customers/service";
import { listIncomes } from "@/lib/incomes/service";
import type { IncomeListRow } from "@/types/income";

const dateFormatter = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Argentina/Buenos_Aires" });

const Home = async () => {
  const { user } = await requirePageUser();
  const referenceInstant = new Date();
  const range = getBuenosAiresSevenDayRange(referenceInstant);
  const fixedCustomerRange = getBuenosAiresRemainingWorkweekRange(referenceInstant);
  const incomeQuery = { dateFrom: range.dateFrom, dateTo: range.dateTo, status: "active", pageSize: 100 } as const;
  const fixedOccurrencesPromise = fixedCustomerRange
    ? listFixedOccurrences(user, fixedCustomerRange)
    : Promise.resolve([]);
  const [firstIncomePage, fixedOccurrences, cashClosed] = await Promise.all([
    listIncomes(user, { ...incomeQuery, page: 1 }),
    fixedOccurrencesPromise,
    isCashClosedForDate(range.dateTo),
  ]);
  const remainingIncomePages = await Promise.all(Array.from({ length: Math.max(firstIncomePage.pagination.totalPages - 1, 0) }, (_, index) => listIncomes(user, { ...incomeQuery, page: index + 2 })));
  const incomeItems: IncomeListRow[] = [firstIncomePage, ...remainingIncomePages].flatMap((page) => page.items as IncomeListRow[]);
  const incomeSummary = buildIncomeSummaryForViewer(user.role.name, incomeItems, range.dateTo);
  const currentDate = dateFormatter.format(referenceInstant);

  const employee = user.role.name === "employee";

  return (
    <div className="relative flex min-w-0 flex-1 flex-col bg-[#f6f5f2] dark:bg-[#0b0b0e]">
      <div className="mx-auto w-full max-w-[1520px] px-4 pt-3 pb-20 min-[360px]:px-5 sm:px-7 lg:px-8 lg:py-7 xl:px-9">
        <header className="mb-5 flex min-h-12 items-center justify-between gap-1.5 lg:mb-6 lg:min-h-0">
          <div className="flex min-w-0 items-center gap-2 lg:gap-3">
            <SidebarTrigger aria-label="Abrir navegación" className="-ml-1 size-11 shrink-0 rounded-full border border-border bg-muted lg:size-9 lg:border-0 lg:bg-transparent dark:bg-[#191920] lg:dark:bg-transparent" />
            <div className="lg:hidden"><BastardosWordmark /></div>
            <div className="min-w-0">
              <p className="hidden text-xs font-medium text-muted-foreground lg:block">Dashboard · <span className="first-letter:uppercase">{currentDate}</span></p>
              <h1 className="sr-only mt-0.5 text-2xl leading-tight font-black tracking-[-0.035em] lg:not-sr-only xl:text-[1.7rem]">Todo lo importante, de un vistazo.</h1>
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-semibold lg:hidden dark:bg-[#191920]">
            {employee ? "Empleado" : "Gerencia"}
          </span>
          <Link href="/incomes" className="hidden min-h-10 shrink-0 items-center gap-2 rounded-full border border-border bg-card px-4 text-xs font-semibold shadow-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring lg:inline-flex dark:bg-[#131318]">
            Ver ingresos <ArrowUpRight aria-hidden="true" className="size-3.5 text-brand-foreground" />
          </Link>
        </header>
        <IncomeSummaryCard summary={incomeSummary} canCreateIncome={!cashClosed} />
        <div className="mt-5 grid min-w-0 gap-4 lg:mt-6 lg:grid-cols-2 lg:gap-6">
          <SevenDayEvolution series={incomeSummary.series} employee={employee} />
          <FixedCustomersCard occurrences={fixedOccurrences} referenceInstant={referenceInstant.toISOString()} employee={employee} />
        </div>
      </div>
      <DashboardMobileNav />
    </div>
  );
};
export default Home;
