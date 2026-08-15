export type CashState = "live" | "closed";

export type CashPerson = {
  id: string;
  firstName: string;
  lastName: string;
};

export type CashSummary = {
  salesGrossTotal: number;
  salesCommissionTotal: number;
  salesBarbershopNet: number;
  adjustmentGrossTotal: number;
  adjustmentCommissionTotal: number;
  adjustmentBarbershopNet: number;
  grossTotal: number;
  commissionTotal: number;
  barbershopNet: number;
  serviceTotal: number;
  productTotal: number;
  saleCount: number;
  activeSaleCount: number;
  voidedSaleCount: number;
  adjustmentCount: number;
};

export type CashPaymentTotal = {
  paymentMethodId: string;
  name: string;
  salesAmount: number;
  adjustmentAmount: number;
  netAmount: number;
};

export type CashSaleAuditItem = {
  id: string;
  createdAt: string;
  employee: CashPerson;
  customerName: string | null;
  kind: "service" | "products" | "combined";
  statusAtClose: "active" | "voided";
  currentStatus: "active" | "voided";
  grossTotal: number;
  commissionTotal: number;
  barbershopNet: number;
};

export type CashAdjustment = {
  id: string;
  sourceIncomeId: string;
  originalBusinessDate: string;
  createdAt: string;
  createdBy: CashPerson;
  grossDelta: number;
  commissionDelta: number;
  barbershopNetDelta: number;
};

export type CashDay = {
  id: string | null;
  businessDate: string;
  state: CashState;
  closedAt: string | null;
  summary: CashSummary;
  payments: CashPaymentTotal[];
  sales: CashSaleAuditItem[];
  adjustments: CashAdjustment[];
};

export type CashHistoryItem = Pick<
  CashDay,
  "id" | "businessDate" | "state" | "closedAt" | "summary"
> & {
  id: string;
  state: "closed";
  closedAt: string;
};

export type CashHistoryQuery = {
  dateFrom?: string;
  dateTo?: string;
  page: number;
  pageSize: number;
};

export type CashPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type PaginatedCashHistory = {
  items: CashHistoryItem[];
  pagination: CashPagination;
};

