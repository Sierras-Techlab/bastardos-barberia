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
