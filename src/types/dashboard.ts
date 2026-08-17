export type DashboardSummary = {
  dailyRevenue: number;
  customersServed: number;
  servicesPerformed: number;
  averageTicket: number;
};

export type DashboardData = {
  isMock: boolean;
  generatedAt: string;
  business: {
    name: string;
    location: string;
    currency: "ARS";
  };
  summary: DashboardSummary;
  revenue: {
    period: string;
    total: number;
    goal: number;
    averageTicket: number;
    changePercentage: number;
    series: Array<{
      label: string;
      value: number;
      transactions: number;
    }>;
  };
  topServices: Array<{
    name: string;
    sales: number;
    revenue: number;
    share: number;
  }>;
  paymentTotals: Array<{
    paymentMethodId: string;
    name: string;
    transactions: number;
    amount: number;
    share: number;
  }>;
  recentActivity: Array<{
    id: string;
    type: "income" | "customer" | "expense" | "cash";
    title: string;
    description: string;
    time: string;
  }>;
};
