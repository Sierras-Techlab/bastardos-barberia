import { Badge } from "@/components/ui/badge";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { FixedCustomersCard } from "@/components/dashboard/fixed-customers-card";
import { IncomeSummaryCard } from "@/components/dashboard/income-summary-card";
import { QuickActionsCard } from "@/components/dashboard/quick-actions-card";
import fixedCustomersMock from "@/data/fixed-customers.mock.json";
import { requirePageUser } from "@/lib/auth/authorization";
import { buildUpcomingFixedOccurrences } from "@/lib/customers/fixed-customers";
import { buildDashboardIncomeSummary, getBuenosAiresSevenDayRange } from "@/lib/dashboard/income-summary";
import { listIncomes } from "@/lib/incomes/service";
import type { FixedCustomerScheduleFixture, IsoWeekday } from "@/types/fixed-customer";

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "America/Argentina/Buenos_Aires",
});

const fixedSchedules: FixedCustomerScheduleFixture[] = fixedCustomersMock.schedules.map((fixture) => ({
  ...fixture,
  schedule: { ...fixture.schedule, weekday: fixture.schedule.weekday as IsoWeekday },
}));

const Home = async () => {
  const { user } = await requirePageUser();
  const range = getBuenosAiresSevenDayRange();
  const incomeQuery = {
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
    status: "active",
    pageSize: 100,
  } as const;
  const firstIncomePage = await listIncomes(user, { ...incomeQuery, page: 1 });
  const remainingIncomePages = await Promise.all(Array.from(
    { length: Math.max(firstIncomePage.pagination.totalPages - 1, 0) },
    (_, index) => listIncomes(user, { ...incomeQuery, page: index + 2 }),
  ));
  const incomes = [firstIncomePage, ...remainingIncomePages].flatMap(({ items }) => items);
  const incomeSummary = buildDashboardIncomeSummary(incomes, range.dateTo);
  const fixedOccurrences = buildUpcomingFixedOccurrences(fixedSchedules, range.dateTo);
  const currentDate = dateFormatter.format(new Date());

  return <>
    <header className="mx-auto flex h-16 w-full max-w-[1600px] shrink-0 items-center justify-between px-5 md:px-7 xl:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <SidebarTrigger className="-ml-1" />
        <div className="min-w-0">
          <p className="truncate font-semibold">Dashboard</p>
          <p className="truncate text-xs text-muted-foreground capitalize">{currentDate}</p>
        </div>
      </div>
      <Badge className="rounded-full bg-white px-3 py-2 text-[#18181b] shadow-sm hover:bg-white">
        <span className="size-2 rounded-full bg-primary" />
        Clientes fijos de demostración
      </Badge>
    </header>

    <main className="mx-auto w-full max-w-[1600px] flex-1 px-5 pb-5 md:px-7 xl:min-h-0 xl:px-8 xl:pb-7">
      <div className="mb-5">
        <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">Resumen del negocio</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">Todo lo importante, de un vistazo.</h1>
        <p className="mt-1 text-sm text-muted-foreground">Ingresos, tareas frecuentes y clientes con horarios habituales.</p>
      </div>
      <div data-testid="dashboard-grid" className="grid gap-5 xl:grid-cols-12 xl:items-start">
        <div className="min-w-0 xl:col-span-8">
          <IncomeSummaryCard summary={incomeSummary} isEmployee={user.role.name === "employee"} />
        </div>
        <div className="grid min-w-0 gap-5 md:grid-cols-2 xl:col-span-4 xl:grid-cols-1">
          <QuickActionsCard />
          <FixedCustomersCard occurrences={fixedOccurrences} dateFrom={range.dateTo} />
        </div>
      </div>
    </main>
  </>;
};

export default Home;
