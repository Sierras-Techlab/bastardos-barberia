import rawMock from "./incomes.mock.json";

import type {
  CurrentUser,
  Employee,
  IncomeListData,
  PaymentMethod,
} from "@/types/income";

type LegacyMockIncome = {
  id: string;
  createdAt: string;
  employee: Employee;
  customer: Employee | null;
  service: { id: string; name: string; price: number } | null;
  products: { id: string; name: string; unitPrice: number; quantity: number }[];
  paymentMethod: PaymentMethod;
  total: number;
  status: "active" | "voided";
};

type LegacyMockData = {
  currentUser: CurrentUser;
  employees: Employee[];
  incomes: LegacyMockIncome[];
};

const itemCommission = (subtotal: number) => ({
  subtotal,
  rate: 0,
  amount: 0,
  fullCommission: false,
  authorizedBy: null,
});

const legacyMock = rawMock as LegacyMockData;

const mock: IncomeListData = {
  currentUser: legacyMock.currentUser,
  employees: legacyMock.employees,
  incomes: legacyMock.incomes.map((income) => ({
    ...income,
    businessDate: income.createdAt.slice(0, 10),
    registeredBy: income.employee,
    payments: [{ method: income.paymentMethod, amount: income.total }],
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
