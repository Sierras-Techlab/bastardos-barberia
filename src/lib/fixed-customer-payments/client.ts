import type { FixedCustomerMonth, FixedCustomerMonthQuery, PayFixedCustomerMonthInput } from "@/types/fixed-customer-payment";

export type FixedCustomerPaymentClient = {
  list(query: FixedCustomerMonthQuery): Promise<FixedCustomerMonth[]>;
  pay(input: PayFixedCustomerMonthInput & { mode: "manager" | "employee" }): Promise<FixedCustomerMonth>;
  get(customerId: string, period: string): Promise<FixedCustomerMonth | null>;
};

const buildQuery = (query: FixedCustomerMonthQuery): string => {
  const params = new URLSearchParams();
  params.set("period", query.period);
  if (query.employeeId) params.set("employeeId", query.employeeId);
  return params.toString();
};

const noStoreRequest = (init?: RequestInit): RequestInit => ({ ...init, cache: "no-store" });

export const fixedCustomerPaymentClient: FixedCustomerPaymentClient = {
  list: async (query) => {
    const response = await fetch(`/api/fixed-customer-months?${buildQuery(query)}`, noStoreRequest());
    if (!response.ok) {
      const error = await response.json().catch(() => ({ code: "UNKNOWN", message: "No se pudo obtener la lista de meses." }));
      throw new Error(error.message ?? "No se pudo obtener la lista de meses.");
    }
    const data: { items: FixedCustomerMonth[] } = await response.json();
    return data.items;
  },
  pay: async (input) => {
    const { mode, ...rest } = input;
    const response = await fetch("/api/fixed-customer-months/pay", noStoreRequest({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, ...rest }),
    }));
    if (!response.ok) {
      const error = await response.json().catch(() => ({ code: "UNKNOWN", message: "No se pudo registrar el cobro." }));
      throw new Error(error.message ?? "No se pudo registrar el cobro.");
    }
    const data: { month: FixedCustomerMonth } = await response.json();
    return data.month;
  },
  get: async (customerId, period) => {
    const params = new URLSearchParams({ customerId, period });
    const response = await fetch(`/api/fixed-customer-months/get?${params.toString()}`, noStoreRequest());
    if (response.status === 404) return null;
    if (!response.ok) {
      const error = await response.json().catch(() => ({ code: "UNKNOWN", message: "No se pudo obtener el mes." }));
      throw new Error(error.message ?? "No se pudo obtener el mes.");
    }
    const data: { month: FixedCustomerMonth | null } = await response.json();
    return data.month;
  },
};