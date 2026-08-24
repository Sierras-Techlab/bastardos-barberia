import { z } from "zod";
import type { FixedCustomerMonth, FixedCustomerMonthQuery, PayFixedCustomerMonthInput } from "@/types/fixed-customer-payment";
import {
  fixedCustomerMonthSchema,
  fixedCustomerMonthsSchema,
  payFixedCustomerMonthInputSchema,
} from "@/lib/fixed-customer-payments/schemas";

export class FixedCustomerPaymentApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "FixedCustomerPaymentApiError";
  }
}

type ErrorBody = { error?: { code?: string; message?: string; fields?: Record<string, string[]> } };

const listEnvelope = z.object({
  data: z.object({
    items: fixedCustomerMonthsSchema,
  }),
}).strict();

const monthEnvelope = z.object({
  data: z.object({
    month: fixedCustomerMonthSchema.nullable(),
  }),
}).strict();

const payEnvelope = z.object({
  data: z.object({
    month: fixedCustomerMonthSchema,
  }),
}).strict();

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

const failWith = async (response: Response, fallback: string): Promise<never> => {
  const body = (await response.json().catch(() => ({}))) as ErrorBody;
  throw new FixedCustomerPaymentApiError(
    response.status,
    body.error?.code ?? "INTERNAL_ERROR",
    body.error?.message ?? fallback,
    body.error?.fields,
  );
};

export const fixedCustomerPaymentClient: FixedCustomerPaymentClient = {
  list: async (query) => {
    const response = await fetch(`/api/fixed-customer-months?${buildQuery(query)}`, noStoreRequest());
    if (!response.ok) await failWith(response, "No se pudo obtener la lista de meses.");
    const raw = await response.json();
    const parsed = listEnvelope.parse(raw);
    return parsed.data.items;
  },
  pay: async (input) => {
    const { mode, ...rest } = input;
    const payload = payFixedCustomerMonthInputSchema.parse({ mode, ...rest });
    const response = await fetch("/api/fixed-customer-months/pay", noStoreRequest({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }));
    if (!response.ok) await failWith(response, "No se pudo registrar el cobro.");
    const raw = await response.json();
    const parsed = payEnvelope.parse(raw);
    return parsed.data.month;
  },
  get: async (customerId, period) => {
    const params = new URLSearchParams({ customerId, period });
    const response = await fetch(`/api/fixed-customer-months/get?${params.toString()}`, noStoreRequest());
    if (response.status === 404) return null;
    if (!response.ok) await failWith(response, "No se pudo obtener el mes.");
    const raw = await response.json();
    const parsed = monthEnvelope.parse(raw);
    return parsed.data.month;
  },
};