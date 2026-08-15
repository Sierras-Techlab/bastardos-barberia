import type {
  CashDay,
  CashHistoryQuery,
  PaginatedCashHistory,
} from "@/types/cash";

type ErrorBody = {
  error?: {
    code?: string;
    message?: string;
    fields?: Record<string, string[]>;
  };
};

export class CashApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "CashApiError";
  }
}

const request = async <T>(url: string): Promise<T> => {
  const response = await fetch(url, { cache: "no-store" });
  const body = (await response.json()) as ErrorBody & { data?: T };

  if (!response.ok) {
    throw new CashApiError(
      response.status,
      body.error?.code ?? "INTERNAL_ERROR",
      body.error?.message ?? "No se pudo consultar la caja.",
      body.error?.fields,
    );
  }

  return body.data as T;
};

const historyQueryString = (query: CashHistoryQuery) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return params.toString();
};

export type CashClient = {
  getDay(date: string): Promise<CashDay>;
  list(query: CashHistoryQuery): Promise<PaginatedCashHistory>;
};

export const cashClient: CashClient = {
  getDay: (date) => request(`/api/cash?date=${encodeURIComponent(date)}`),
  list: (query) => request(`/api/cash/history?${historyQueryString(query)}`),
};
