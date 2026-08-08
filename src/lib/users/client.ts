import type {
  CreateUserInput,
  UpdateUserInput,
} from "@/lib/auth/schemas";
import type {
  PaginatedUsers,
  Role,
  SafeUser,
} from "@/lib/auth/types";

export type AdminUserFilters = {
  page: number;
  pageSize: number;
  search?: string;
  roleId?: 1 | 2 | 3;
  status: "all" | "active" | "inactive";
};

type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
    fields?: Record<string, string[]>;
  };
};

export class AdminApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "AdminApiError";
  }
}

const request = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init);
  const body = await response.json() as ApiErrorBody & { data?: T };

  if (!response.ok) {
    throw new AdminApiError(
      response.status,
      body.error?.code ?? "INTERNAL_ERROR",
      body.error?.message ?? "No se pudo completar la operación.",
      body.error?.fields,
    );
  }

  return body.data as T;
};

const jsonRequest = (method: "POST" | "PATCH" | "PUT", body: unknown) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const listAdminUsers = (
  filters: AdminUserFilters,
  signal?: AbortSignal,
) => {
  const params = new URLSearchParams({
    page: String(filters.page),
    pageSize: String(filters.pageSize),
  });
  const search = filters.search?.trim();
  if (search) params.set("search", search);
  if (filters.roleId) params.set("roleId", String(filters.roleId));
  params.set("status", filters.status);

  return request<PaginatedUsers>(
    "/api/admin/users?" + params.toString(),
    { signal },
  );
};

export const listAdminRoles = () =>
  request<Role[]>("/api/admin/roles");

export const createAdminUser = (input: CreateUserInput) =>
  request<SafeUser>("/api/admin/users", jsonRequest("POST", input));

export const updateAdminUser = (id: string, changes: UpdateUserInput) =>
  request<SafeUser>(
    "/api/admin/users/" + encodeURIComponent(id),
    jsonRequest("PATCH", changes),
  );

export const setAdminUserActive = (id: string, isActive: boolean) =>
  updateAdminUser(id, { isActive });

export const resetAdminUserPassword = (id: string, password: string) =>
  request<SafeUser>(
    "/api/admin/users/" + encodeURIComponent(id) + "/password",
    jsonRequest("PUT", { password }),
  );

export const deleteAdminUser = (id: string) =>
  request<{ id: string }>("/api/admin/users/" + encodeURIComponent(id), {
    method: "DELETE",
  });
