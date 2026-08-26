export type ReportMetrics = {
  grossIncome: number;
  commission: number;
  barbershopNet: number;
  expenses: number;
  operatingResult: number;
  operatingMarginBps: number | null;
};

export type DailyReportMetrics = {
  grossIncome: number;
  expenses: number;
  operatingResult: number;
};

export type IncomeBreakdownKey = "services" | "products" | "subscriptions";
export type ExpenseBreakdownKey = "fixed" | "variable" | "supplies";

export type ReportBreakdown = {
  key: IncomeBreakdownKey | ExpenseBreakdownKey;
  amount: number;
};

export type ReportNamedBreakdown = {
  id: string;
  name: string;
  amount: number;
};

export type ReportRankedItem = ReportNamedBreakdown & { quantity: number };
export type ReportDayHighlight = { date: string; amount: number };

export type BusinessReport = {
  month: string;
  generatedAt: string;
  period: {
    from: string;
    to: string;
    elapsedDays: number;
    daysInMonth: number;
    isCurrentMonth: boolean;
  };
  comparison: {
    month: string;
    from: string;
    to: string;
  };
  summary: ReportMetrics;
  previousSummary: ReportMetrics;
  projection: ReportMetrics | null;
  daily: Array<{
    day: number;
    selected: DailyReportMetrics;
    previous: DailyReportMetrics | null;
  }>;
  incomeComposition: Array<ReportBreakdown & { key: IncomeBreakdownKey }>;
  paymentComposition: ReportNamedBreakdown[];
  expenseComposition: Array<ReportBreakdown & { key: ExpenseBreakdownKey }>;
  serviceRanking: ReportRankedItem[];
  productRanking: ReportRankedItem[];
  highlights: {
    bestDay: ReportDayHighlight | null;
    worstDay: ReportDayHighlight | null;
  };
};
