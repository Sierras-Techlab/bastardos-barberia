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

export type IncomeBreakdownKey = "services" | "products" | "subscriptions" | "chair_rentals";
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
export type ReportTeamMetrics = {
  saleCount: number;
  grossIncome: number;
  commission: number;
  barbershopNet: number;
  averageTicket: number | null;
  workedMinutes: number | null;
  grossPerHour: number | null;
  netPerHour: number | null;
  outsideSessionSaleCount: number;
};
export type ReportTeamMember = {
  id: string;
  name: string;
  role: "owner" | "admin" | "employee";
  current: ReportTeamMetrics;
  previous: ReportTeamMetrics;
};

export type ChairRentalObligation = {
  employeeId: string;
  employeeName: string;
  period: string;
  amount: number;
  dueDay: number;
  status: "pending" | "overdue";
};
export type ChairRentalPayer = {
  employeeId: string;
  employeeName: string;
  amount: number;
  paymentCount: number;
};
export type ChairRentalEffectiveDate = {
  date: string;
  amount: number;
  count: number;
};
export type ChairRentalSummary = {
  total: number;
  count: number;
  byEffectiveDate?: ChairRentalEffectiveDate[];
  payingEmployees: ChairRentalPayer[];
  pending: ChairRentalObligation[];
  overdue: ChairRentalObligation[];
};

export type BusinessReport = {
  month: string;
  availableMonths: string[];
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
  chairRentals?: ChairRentalSummary;
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
  teamPerformance: ReportTeamMember[];
  highlights: {
    bestDay: ReportDayHighlight | null;
    worstDay: ReportDayHighlight | null;
  };
};
