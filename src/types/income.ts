import type { PaymentMethod, IncomePayment, IncomePaymentInput } from "@/types/payment-method";

export type { IncomePayment, IncomePaymentInput } from "@/types/payment-method";
export type UserRole = "owner" | "admin" | "employee";
export type IncomeSourceType = "sale" | "fixed_subscription";
export type Employee = { id: string; firstName: string; lastName: string };
export type Customer = Employee & { phone?: string };
export type Service = { id: string; name: string; price: number };
export type Product = { id: string; name: string; price: number; stock: number };
export type CurrentUser = Employee & { role: UserRole };
export type IncomeFormEmployee = CurrentUser & { isActive: boolean; serviceCommissionRate: number; productCommissionRate: number };

export type EmployeeCatalogService = {
  id: string;
  name: string;
  price: number;
  earning: number;
  commissionRate: number;
};
export type EmployeeCatalogProduct = { id: string; name: string; earning: number; stock: number };

export type ManagerIncomeFormData = {
  viewer: "manager";
  currentUser: CurrentUser;
  services: Service[];
  products: Product[];
  customers: Customer[];
  paymentMethods: PaymentMethod[];
  employees?: IncomeFormEmployee[];
};

export type EmployeeIncomeFormData = {
  viewer: "employee";
  currentUser: CurrentUser;
  services: EmployeeCatalogService[];
  products: EmployeeCatalogProduct[];
  customers: Customer[];
  paymentMethods: PaymentMethod[];
};

export type IncomeFormData = ManagerIncomeFormData | EmployeeIncomeFormData;
export type IncomeProductInput = { productId: string; quantity: number; grantFullCommission: boolean };
export type CreateIncomeInput = {
  requestId: string;
  employeeId: string;
  customerId: string | null;
  serviceId: string | null;
  products: IncomeProductInput[];
  payments: IncomePaymentInput[];
  grantFullServiceCommission: boolean;
  servicePriceOverride?: { chargedUnitPrice: number; reason: string } | null;
  productPriceOverrides?: Record<string, { chargedUnitPrice: number; reason: string }>;
};
export type IncomeStatus = "active" | "voided";
export type IncomeKind = "service" | "products" | "combined" | "subscription";
export type IncomeSubscriptionConcept = {
  period: string;
  monthlyPrice: number;
  commissionAmount: number;
  barbershopNet: number;
  responsibleUserId: string;
  label: string;
};
export type IncomeListService = Service & { commission: import("@/types/income-commissions").IncomeItemCommissionSnapshot };
export type IncomeListProduct = { id: string; name: string; unitPrice: number; quantity: number; commission: import("@/types/income-commissions").IncomeItemCommissionSnapshot };
export type IncomeListSubscription = {
  sourceType: "fixed_subscription";
  period: string;
  monthlyPrice: number;
  label: string;
  employeeEarning: number;
  barbershopNet: number;
};
export type IncomeListItem = {
  id: string; createdAt: string; businessDate: string; sourceType?: IncomeSourceType; employee: Employee; customer: Employee | null;
  service: IncomeListService | null; products: IncomeListProduct[]; subscription?: IncomeListSubscription | null;
  payments: IncomePayment[]; registeredBy: Employee; commission: import("@/types/income-commissions").IncomeCommissionSnapshot; total: number; grossTotal?: number; status: IncomeStatus;
};
export type EmployeeIncomeListConceptType = "service" | "product";
export type EmployeeIncomeListConcept = {
  id: string;
  type: EmployeeIncomeListConceptType;
  name: string;
  quantity: number;
  earning: number;
};
export type EmployeeIncomeListItem = {
  id: string;
  createdAt: string;
  businessDate: string;
  customer: Employee | null;
  concepts: EmployeeIncomeListConcept[];
  employeeCommission: number;
  status: IncomeStatus;
};
export type Income = IncomeListItem;
export type IncomeService = { create(input: CreateIncomeInput): Promise<Income> };
export type IncomeListFilters = { query: string; dateFrom: string; dateTo: string; employeeId: string; paymentMethodId: string | "all"; kind: IncomeKind | "all"; status?: IncomeStatus | "all" };
export type IncomeListQuery = { query?: string; dateFrom?: string; dateTo?: string; userId?: string; paymentMethodId?: string; kind?: IncomeKind; status?: IncomeStatus; page: number; pageSize: number };
export type IncomePaymentTotal = { paymentMethodId: string; name: string; amount: number };
export type IncomeListMetrics = { grossTotal: number; commissionTotal: number; barbershopNet: number; count: number; average: number; paymentTotals: IncomePaymentTotal[] };
export type EmployeeIncomeListMetrics = { count: number; employeeCommissionTotal: number };
export type IncomePagination = { page: number; pageSize: number; total: number; totalPages: number };
export type ManagerPaginatedIncomes = { items: IncomeListItem[]; metrics: IncomeListMetrics; pagination: IncomePagination };
export type EmployeePaginatedIncomes = { items: EmployeeIncomeListItem[]; metrics: EmployeeIncomeListMetrics; pagination: IncomePagination };
export type PaginatedIncomes = ManagerPaginatedIncomes | EmployeePaginatedIncomes;
export type IncomeListData = { currentUser: CurrentUser; employees: Employee[]; paymentMethods: PaymentMethod[]; incomes: IncomeListItem[] };

export type IncomeListRow = IncomeListItem | EmployeeIncomeListItem;
export type PaginatedIncomeItems = ReadonlyArray<IncomeListRow>;

export const isEmployeeIncomeListItem = (
  row: IncomeListRow,
): row is EmployeeIncomeListItem =>
  Array.isArray((row as EmployeeIncomeListItem).concepts) &&
  typeof (row as EmployeeIncomeListItem).employeeCommission === "number";

export const isManagerIncomeListItem = (
  row: IncomeListRow,
): row is IncomeListItem =>
  "payments" in row &&
  Array.isArray((row as IncomeListItem).payments) &&
  "total" in row;

export const isManagerPaginatedIncomes = (
  data: PaginatedIncomes,
): data is ManagerPaginatedIncomes => Array.isArray((data as ManagerPaginatedIncomes).items)
  && (data as ManagerPaginatedIncomes).items.every(isManagerIncomeListItem);

export const isEmployeePaginatedIncomes = (
  data: PaginatedIncomes,
): data is EmployeePaginatedIncomes => Array.isArray((data as EmployeePaginatedIncomes).items)
  && (data as EmployeePaginatedIncomes).items.every(isEmployeeIncomeListItem);
