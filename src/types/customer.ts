import type { FixedSchedule } from "@/types/fixed-customer";

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
};

export type CustomerCatalogData = { customers: Customer[] };

export type CustomerSort = "original" | "visits-desc" | "visits-asc" | "newest" | "oldest";
export type CustomerScheduleFilter = "all" | "fixed" | "not-fixed";

export type CustomerEditorInput = Pick<Customer, "firstName" | "lastName" | "email" | "phone">;
export type CreateCustomerInput = CustomerEditorInput & { fixedSchedule: FixedSchedule | null };
export type UpdateCustomerInput = Partial<CustomerEditorInput & {
  fixedSchedule: FixedSchedule | null;
  expectedScheduleVersion: number;
}>;

export type CustomerVisit = {
  id: string;
  occurredAt: string;
  businessDate: string;
  items: Array<{
    type: "service" | "product";
    name: string;
    quantity: number;
  }>;
};

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
