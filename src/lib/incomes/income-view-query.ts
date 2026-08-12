import type { IncomeListFilters, IncomeListQuery, UserRole } from "@/types/income";

export const toRoleSafeIncomeQuery = (filters: IncomeListFilters, role: UserRole, page = 1, pageSize = 10): IncomeListQuery => ({
  page,
  pageSize,
  ...(filters.query && { query: filters.query }),
  ...(filters.dateFrom && { dateFrom: filters.dateFrom }),
  ...(filters.dateTo && { dateTo: filters.dateTo }),
  ...(role !== "employee" && filters.employeeId && { userId: filters.employeeId }),
  ...(filters.paymentMethod !== "all" && { paymentMethod: filters.paymentMethod }),
  ...(filters.kind !== "all" && { kind: filters.kind }),
  ...(filters.status && filters.status !== "all" && { status: filters.status }),
});
