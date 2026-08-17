import rawMock from "./incomes.mock.json";

import type {
  CurrentUser,
  Employee,
  IncomeListData,
} from "@/types/income";
import type { IncomePayment, PaymentMethod } from "@/types/payment-method";

type MockIncome = {
  id: string;
  createdAt: string;
  employee: Employee;
  customer: Employee | null;
  service: { id: string; name: string; price: number } | null;
  products: { id: string; name: string; unitPrice: number; quantity: number }[];
  payments: IncomePayment[];
  total: number;
  status: "active" | "voided";
};

type MockData = {
  currentUser: CurrentUser;
  employees: Employee[];
  paymentMethods: PaymentMethod[];
  incomes: MockIncome[];
};

const itemCommission = (subtotal: number) => ({
  subtotal,
  rate: 0,
  amount: 0,
  fullCommission: false,
  authorizedBy: null,
});

const data = rawMock as MockData;

const mock: IncomeListData = {
  currentUser: data.currentUser,
  employees: data.employees,
  paymentMethods: data.paymentMethods,
  incomes: data.incomes.map((income) => ({
    ...income,
    businessDate: income.createdAt.slice(0, 10),
    registeredBy: income.employee,
    service: income.service
      ? { ...income.service, commission: itemCommission(income.service.price) }
      : null,
    products: income.products.map((product) => ({
      ...product,
      commission: itemCommission(product.unitPrice * product.quantity),
    })),
    commission: { total: 0, barbershopNet: income.total },
  })),
};

export default mock;
