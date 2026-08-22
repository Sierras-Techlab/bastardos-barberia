import type { CustomerVisitProjection } from "@/lib/supabase/database.types";
import type { FixedSchedule, FixedScheduleInput } from "@/types/fixed-customer";

export type Customer = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string;
  visits: number;
  createdAt: string;
  fixedSchedule: FixedSchedule | null;
  fixedScheduleVersion: number | null;
  lastVisitBusinessDate: string | null;
};

export type CustomerCatalogData = { customers: Customer[] };

export type CustomerSort = "original" | "visits-desc" | "visits-asc" | "newest" | "oldest";
export type CustomerScheduleFilter = "all" | "fixed" | "not-fixed";

export type CustomerEditorInput = Pick<Customer, "firstName" | "lastName" | "email" | "phone">;
export type CreateCustomerInput = CustomerEditorInput & { fixedSchedule: FixedScheduleInput | null };
export type UpdateCustomerInput = Partial<CustomerEditorInput & {
  fixedSchedule: FixedScheduleInput | null;
  expectedScheduleVersion: number;
}>;

export type CustomerVisit = CustomerVisitProjection;

export type PaginatedCustomerVisits = {
  items: CustomerVisit[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};
export type CustomerVisitQuery = { page: number; pageSize: number };

export type CustomerMetrics = {
  totalCustomers: number;
  newCustomers: number;
  totalVisits: number;
};
