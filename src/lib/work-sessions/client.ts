import type {
  EmployeeWorkSession,
  ManagerWorkSession,
  PaginatedWorkSessions,
  WorkSessionCorrectionInput,
  WorkSessionListQuery,
} from "@/types/work-session";

type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
    fields?: Record<string, string[]>;
  };
};

export class WorkSessionApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "WorkSessionApiError";
  }
}

const request = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, { cache: "no-store", ...init });
  const body = (await response.json()) as ApiErrorBody & { data?: T };

  if (!response.ok) {
    throw new WorkSessionApiError(
      response.status,
      body.error?.code ?? "INTERNAL_ERROR",
      body.error?.message ?? "No se pudo completar la operación.",
      body.error?.fields,
    );
  }

  return body.data as T;
};

const listQueryString = (query: WorkSessionListQuery) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return params.toString();
};

export type WorkSessionClient = {
  current(): Promise<EmployeeWorkSession | null>;
  list(query: WorkSessionListQuery): Promise<PaginatedWorkSessions>;
  start(): Promise<EmployeeWorkSession>;
  end(): Promise<EmployeeWorkSession>;
  correct(
    id: string,
    input: WorkSessionCorrectionInput,
  ): Promise<ManagerWorkSession>;
};

export const workSessionClient: WorkSessionClient = {
  current: () => request<EmployeeWorkSession | null>("/api/work-sessions/current"),

  list: (query) =>
    request<PaginatedWorkSessions>(
      `/api/work-sessions?${listQueryString(query)}`,
    ),

  start: () => request<EmployeeWorkSession>("/api/work-sessions/start", { method: "POST" }),

  end: () => request<EmployeeWorkSession>("/api/work-sessions/end", { method: "POST" }),

  correct: (id, input) =>
    request<ManagerWorkSession>(`/api/work-sessions/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
};
