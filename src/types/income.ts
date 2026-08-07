export type PaymentMethod = "cash" | "transfer";
export type UserRole = "owner" | "employee";

export type Employee = {
  id: string;
  firstName: string;
  lastName: string;
};

export type Customer = {
  id: string;
  firstName: string;
  lastName: string;
};

export type Service = {
  id: string;
  name: string;
  price: number;
};

export type Product = {
  id: string;
  name: string;
  price: number;
  stock: number;
};

export type CurrentUser = Employee & {
  role: UserRole;
};

export type IncomeFormData = {
  currentUser: CurrentUser;
  employees: Employee[];
  customers: Customer[];
  services: Service[];
  products: Product[];
};

export type IncomeProductInput = {
  productId: string;
  quantity: number;
};

export type CreateIncomeInput = {
  employeeId: string;
  customerId: string | null;
  serviceId: string | null;
  products: IncomeProductInput[];
  paymentMethod: PaymentMethod;
};

export type Income = CreateIncomeInput & {
  id: string;
  total: number;
  createdAt: string;
};

export type IncomeService = {
  create: (input: CreateIncomeInput) => Promise<Income>;
};

export type IncomeStatus = "active" | "voided";
export type IncomeKind = "service" | "products" | "combined";

export type IncomeListProduct = {
  id: string;
  name: string;
  unitPrice: number;
  quantity: number;
};

export type IncomeListItem = {
  id: string;
  createdAt: string;
  employee: Employee;
  customer: Customer | null;
  service: Service | null;
  products: IncomeListProduct[];
  paymentMethod: PaymentMethod;
  total: number;
  status: IncomeStatus;
};

export type IncomeListFilters = {
  query: string;
  dateFrom: string;
  dateTo: string;
  employeeId: string;
  paymentMethod: PaymentMethod | "all";
  kind: IncomeKind | "all";
};

export type IncomeListMetrics = {
  total: number;
  count: number;
  average: number;
  cashTotal: number;
  transferTotal: number;
};

export type IncomeListData = {
  currentUser: CurrentUser;
  employees: Employee[];
  incomes: IncomeListItem[];
};
