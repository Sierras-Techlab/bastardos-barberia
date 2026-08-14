import type {
  PaymentMethod,
  PaymentMethodInput,
  PaymentMethodUpdate,
} from "@/types/payment-method";

type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
    fields?: Record<string, string[]>;
  };
};

export class PaymentMethodApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "PaymentMethodApiError";
  }
}

const request = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init);
  const body = (await response.json()) as ApiErrorBody & { data?: T };

  if (!response.ok) {
    throw new PaymentMethodApiError(
      response.status,
      body.error?.code ?? "INTERNAL_ERROR",
      body.error?.message ?? "No se pudo completar la operación.",
      body.error?.fields,
    );
  }

  return body.data as T;
};

const jsonRequest = (method: "POST" | "PATCH", body: unknown) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export type PaymentMethodClient = {
  list(): Promise<PaymentMethod[]>;
  get(id: string): Promise<PaymentMethod>;
  create(input: PaymentMethodInput): Promise<PaymentMethod>;
  update(id: string, input: PaymentMethodUpdate): Promise<PaymentMethod>;
  deactivate(id: string): Promise<PaymentMethod>;
};

export const paymentMethodClient: PaymentMethodClient = {
  async list() {
    return (await request<{ paymentMethods: PaymentMethod[] }>(
      "/api/payment-methods",
    )).paymentMethods;
  },

  get(id) {
    return request<PaymentMethod>(
      `/api/payment-methods/${encodeURIComponent(id)}`,
    );
  },

  create(input) {
    return request<PaymentMethod>(
      "/api/payment-methods",
      jsonRequest("POST", input),
    );
  },

  update(id, input) {
    return request<PaymentMethod>(
      `/api/payment-methods/${encodeURIComponent(id)}`,
      jsonRequest("PATCH", input),
    );
  },

  deactivate(id) {
    return request<PaymentMethod>(
      `/api/payment-methods/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
  },
};
