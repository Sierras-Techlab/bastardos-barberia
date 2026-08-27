import { z } from "zod";

import {
  employeeWorkSessionSchema,
  managerWorkSessionSchema,
  paginatedEmployeeWorkSessionsSchema,
  paginatedManagerWorkSessionsSchema,
} from "@/lib/work-sessions/schemas";
import type {
  EmployeeWorkSession,
  ManagerWorkSession,
  PaginatedEmployeeWorkSessions,
  PaginatedManagerWorkSessions,
  PaginatedWorkSessions,
  WorkSessionCorrectionInput,
  WorkSessionListQuery,
} from "@/types/work-session";

const successEnvelopeSchema = z.object({ data: z.unknown() }).strict();
const errorEnvelopeSchema = z
  .object({
    error: z
      .object({
        code: z.string().optional(),
        message: z.string().optional(),
        fields: z.record(z.string(), z.array(z.string())).optional(),
      })
      .strict()
      .optional(),
  })
  .passthrough();
const nullableEmployeeWorkSessionSchema = employeeWorkSessionSchema.nullable();

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

const request = async <T>(
  url: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
): Promise<T> => {
  const response = await fetch(url, { cache: "no-store", ...init });
  const body: unknown = await response.json();

  if (!response.ok) {
    const parsedError = errorEnvelopeSchema.safeParse(body);
    const error = parsedError.success ? parsedError.data.error : undefined;
    throw new WorkSessionApiError(
      response.status,
      error?.code ?? "INTERNAL_ERROR",
      error?.message ?? "No se pudo completar la operación.",
      error?.fields,
    );
  }

  return schema.parse(successEnvelopeSchema.parse(body).data);
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
  list: typeof list;
  start(): Promise<EmployeeWorkSession>;
  end(): Promise<EmployeeWorkSession>;
  correct(
    id: string,
    input: WorkSessionCorrectionInput,
  ): Promise<ManagerWorkSession>;
};

export type WorkSessionViewerRole = "employee" | "owner" | "admin";

function list(
  query: WorkSessionListQuery,
  viewerRole: "employee",
): Promise<PaginatedEmployeeWorkSessions>;
function list(
  query: WorkSessionListQuery,
  viewerRole: "owner" | "admin",
): Promise<PaginatedManagerWorkSessions>;
function list(
  query: WorkSessionListQuery,
  viewerRole: WorkSessionViewerRole,
): Promise<PaginatedWorkSessions>;
function list(
  query: WorkSessionListQuery,
  viewerRole: WorkSessionViewerRole,
) {
  return request(
    `/api/work-sessions?${listQueryString(query)}`,
    viewerRole === "employee"
      ? paginatedEmployeeWorkSessionsSchema
      : paginatedManagerWorkSessionsSchema,
  );
}

export const workSessionClient: WorkSessionClient = {
  current: () =>
    request("/api/work-sessions/current", nullableEmployeeWorkSessionSchema),

  list,

  start: () =>
    request("/api/work-sessions/start", employeeWorkSessionSchema, {
      method: "POST",
    }),

  end: () =>
    request("/api/work-sessions/end", employeeWorkSessionSchema, {
      method: "POST",
    }),

  correct: (id, input) =>
    request(
      `/api/work-sessions/${encodeURIComponent(id)}`,
      managerWorkSessionSchema,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
    ),
};
