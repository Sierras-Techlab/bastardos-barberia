import type { IncomeListItem } from "@/types/income";

export type DashboardIncomeDay = { date: string; label: string; total: number; count: number };
export type DashboardIncomeSummary = {
  today: { total: number; count: number; average: number; cashTotal: number; transferTotal: number };
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

export const buildDashboardIncomeSummary = (incomes: IncomeListItem[], dateTo: string): DashboardIncomeSummary => {
  const activeIncomes = incomes.filter(({ status }) => status === "active");
  const todayIncomes = activeIncomes.filter(({ businessDate }) => businessDate === dateTo);
  const todayTotal = todayIncomes.reduce((total, income) => total + income.total, 0);
  const paymentTotals = todayIncomes.reduce((totals, income) => {
    for (const payment of income.payments) totals[payment.method] += payment.amount;
    return totals;
  }, { cash: 0, transfer: 0 });
  const dates = datesEndingAt(dateTo);

  return {
    today: {
      total: todayTotal,
      count: todayIncomes.length,
      average: todayIncomes.length > 0 ? todayTotal / todayIncomes.length : 0,
      cashTotal: paymentTotals.cash,
      transferTotal: paymentTotals.transfer,
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
