import type { EmployeeIncomeListItem, IncomeListItem, IncomeListRow, UserRole } from "@/types/income";

export type DashboardIncomeDay = { date: string; label: string; total: number; count: number };
export type DashboardIncomeSummary = {
  today: { total: number; count: number; average: number; paymentTotals: Array<{ paymentMethodId: string; name: string; amount: number }> };
  series: DashboardIncomeDay[];
};
export type EmployeeDashboardIncomeSummary = {
  viewer: "employee";
  today: { employeeCommission: number; count: number };
  series: DashboardIncomeDay[];
};

const formatBuenosAiresDate = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
};

const datesEndingAt = (dateTo: string) => {
  const anchor = new Date(`${dateTo}T00:00:00.000Z`);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(anchor);
    date.setUTCDate(anchor.getUTCDate() - (6 - index));
    return date.toISOString().slice(0, 10);
  });
};

const weekdayLabel = (date: string) => new Intl.DateTimeFormat("es-AR", { weekday: "short", timeZone: "UTC" })
  .format(new Date(`${date}T12:00:00.000Z`))
  .replace(".", "");

export const getBuenosAiresSevenDayRange = (now = new Date()) => {
  const dateTo = formatBuenosAiresDate(now);
  const dates = datesEndingAt(dateTo);
  return { dateFrom: dates[0], dateTo, dates };
};

const isEmployeeRow = (row: IncomeListRow): row is EmployeeIncomeListItem =>
  Array.isArray((row as EmployeeIncomeListItem).concepts);

export const buildDashboardIncomeSummary = (
  incomes: IncomeListItem[],
  dateTo: string,
): DashboardIncomeSummary => {
  const activeIncomes = incomes.filter(({ status }) => status === "active");
  const todayIncomes = activeIncomes.filter(({ businessDate }) => businessDate === dateTo);
  const todayTotal = todayIncomes.reduce((total, income) => total + income.total, 0);
  const paymentTotalsById = new Map<string, { paymentMethodId: string; name: string; amount: number }>();
  for (const payment of todayIncomes.flatMap((income) => income.payments)) {
    const current = paymentTotalsById.get(payment.paymentMethodId);
    paymentTotalsById.set(payment.paymentMethodId, {
      paymentMethodId: payment.paymentMethodId,
      name: payment.methodName,
      amount: (current?.amount ?? 0) + payment.amount,
    });
  }
  const dates = datesEndingAt(dateTo);

  return {
    today: {
      total: todayTotal,
      count: todayIncomes.length,
      average: todayIncomes.length > 0 ? todayTotal / todayIncomes.length : 0,
      paymentTotals: [...paymentTotalsById.values()],
    },
    series: dates.map((date) => {
      const dayIncomes = activeIncomes.filter(({ businessDate }) => businessDate === date);
      return {
        date,
        label: weekdayLabel(date),
        total: dayIncomes.reduce((total, income) => total + income.total, 0),
        count: dayIncomes.length,
      };
    }),
  };
};

export const buildEmployeeDashboardIncomeSummary = (
  incomes: IncomeListRow[],
  dateTo: string,
): EmployeeDashboardIncomeSummary => {
  const activeIncomes = incomes.filter(({ status }) => status === "active");
  const dates = datesEndingAt(dateTo);

  const today = activeIncomes.filter(({ businessDate }) => businessDate === dateTo);
  const todayCommission = today.reduce(
    (total, income) => total + (isEmployeeRow(income) ? income.employeeCommission : 0),
    0,
  );

  return {
    viewer: "employee",
    today: {
      employeeCommission: todayCommission,
      count: today.length,
    },
    series: dates.map((date) => {
      const dayIncomes = activeIncomes.filter(({ businessDate }) => businessDate === date);
      const commission = dayIncomes.reduce(
        (total, income) => total + (isEmployeeRow(income) ? income.employeeCommission : 0),
        0,
      );
      return {
        date,
        label: weekdayLabel(date),
        total: commission,
        count: dayIncomes.length,
      };
    }),
  };
};

export const buildIncomeSummaryForViewer = (
  viewer: UserRole,
  incomes: IncomeListRow[],
  dateTo: string,
): DashboardIncomeSummary | EmployeeDashboardIncomeSummary => {
  if (incomes.length === 0) {
    const emptyDates = datesEndingAt(dateTo);
    if (viewer === "employee") {
      return {
        viewer: "employee",
        today: { employeeCommission: 0, count: 0 },
        series: emptyDates.map((date) => ({ date, label: weekdayLabel(date), total: 0, count: 0 })),
      } satisfies EmployeeDashboardIncomeSummary;
    }
    return {
      today: { total: 0, count: 0, average: 0, paymentTotals: [] },
      series: emptyDates.map((date) => ({ date, label: weekdayLabel(date), total: 0, count: 0 })),
    } satisfies DashboardIncomeSummary;
  }
  const firstIsEmployee = isEmployeeRow(incomes[0]);
  if (viewer === "employee" || firstIsEmployee) {
    return buildEmployeeDashboardIncomeSummary(incomes, dateTo);
  }
  return buildDashboardIncomeSummary(incomes as IncomeListItem[], dateTo);
};
