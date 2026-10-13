export type EmployeeCommercialAgreement = {
  serviceCommissionEnabled: boolean;
  productCommissionEnabled: boolean;
  chairRentalEnabled: boolean;
  monthlyChairRentalAmount: number | null;
  chairRentalEffectiveFrom: string | null;
  chairRentalDueDay: number | null;
};

export type ChairRentalStatus = "pending" | "paid" | "overdue" | "voided";

export type ChairRentalPayment = {
  id: string;
  employeeId: string;
  employeeName: string;
  period: string;
  amount: number;
  status: ChairRentalStatus;
  paymentMethodId: string | null;
  paymentMethodName: string | null;
  confirmedBy: { id: string; firstName: string; lastName: string } | null;
  paidAt: string | null;
  businessDate: string | null;
  incomeId: string | null;
  voidedAt: string | null;
  voidedBy: { id: string; firstName: string; lastName: string } | null;
  voidReason: string | null;
};

export type ChairRentalList = {
  items: ChairRentalPayment[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
