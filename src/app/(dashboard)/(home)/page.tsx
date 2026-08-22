import { SidebarTrigger } from "@/components/ui/sidebar";
import { FixedCustomersCard } from "@/components/dashboard/fixed-customers-card";
import { IncomeSummaryCard } from "@/components/dashboard/income-summary-card";
import { QuickActionsCard } from "@/components/dashboard/quick-actions-card";
import { requirePageUser } from "@/lib/auth/authorization";
import { buildDashboardIncomeSummary, getBuenosAiresSevenDayRange } from "@/lib/dashboard/income-summary";
import { getBuenosAiresRemainingWorkweekRange } from "@/lib/dashboard/workweek-range";
import { listFixedOccurrences } from "@/lib/fixed-customers/service";
import { listIncomes } from "@/lib/incomes/service";

const dateFormatter = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Argentina/Buenos_Aires" });

const Home = async () => {
  const { user } = await requirePageUser();
  const range = getBuenosAiresSevenDayRange();
  const fixedCustomerRange = getBuenosAiresRemainingWorkweekRange();
  const incomeQuery = { dateFrom: range.dateFrom, dateTo: range.dateTo, status: "active", pageSize: 100 } as const;
  const fixedOccurrencesPromise = fixedCustomerRange
    ? listFixedOccurrences(user, fixedCustomerRange)
    : Promise.resolve([]);
  const [firstIncomePage, fixedOccurrences] = await Promise.all([
    listIncomes(user, { ...incomeQuery, page: 1 }),
    fixedOccurrencesPromise,
  ]);
  const remainingIncomePages = await Promise.all(Array.from({ length: Math.max(firstIncomePage.pagination.totalPages - 1, 0) }, (_, index) => listIncomes(user, { ...incomeQuery, page: index + 2 })));
  type PageLike = { items?: unknown };
  const incomeItems = [firstIncomePage, ...remainingIncomePages].flatMap((page) => {
    const items = (page as PageLike).items;
    return Array.isArray(items) ? items.filter((item) => item && typeof item === "object" && !("employeeCommission" in item)) : [];
  });
  const incomeSummary = buildDashboardIncomeSummary(incomeItems as never, range.dateTo);
  const currentDate = dateFormatter.format(new Date());

  return <><header className="mx-auto flex h-16 w-full max-w-[1600px] shrink-0 items-center px-5 md:px-7 xl:px-8"><div className="flex min-w-0 items-center gap-3"><SidebarTrigger className="-ml-1" /><div className="min-w-0"><p className="truncate font-semibold">Dashboard</p><p className="truncate text-xs text-muted-foreground capitalize">{currentDate}</p></div></div></header><main className="mx-auto w-full max-w-[1600px] flex-1 px-5 pb-5 md:px-7 xl:min-h-0 xl:px-8 xl:pb-7"><div className="mb-5"><p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">Resumen del negocio</p><h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">Todo lo importante, de un vistazo.</h1><p className="mt-1 text-sm text-muted-foreground">Ingresos, tareas frecuentes y clientes con horarios habituales.</p></div><div data-testid="dashboard-grid" className="grid gap-5 xl:grid-cols-12 xl:items-start"><div className="min-w-0 xl:col-span-8"><IncomeSummaryCard summary={incomeSummary} isEmployee={user.role.name === "employee"} /></div><div className="grid min-w-0 gap-5 md:grid-cols-2 xl:col-span-4 xl:grid-cols-1"><QuickActionsCard /><FixedCustomersCard occurrences={fixedOccurrences} /></div></div></main></>;
};
export default Home;
