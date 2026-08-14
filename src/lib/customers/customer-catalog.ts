import { z } from "zod";

import type {
  Customer,
  CustomerCatalogData,
  CustomerEditorInput,
  CustomerMetrics,
  CustomerSort,
} from "@/types/customer";
import { createCustomerSchema, fixedScheduleSchema } from "@/lib/customers/schemas";

const customerSchema = z.object({
  id: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.email().nullable(),
  phone: z.string().min(1),
  visits: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  fixedSchedule: fixedScheduleSchema.nullable().default(null),
  fixedScheduleVersion: z.number().int().positive().nullable().default(null),
}).strict();

const customerCatalogFixtureSchema = z.object({
  isMock: z.literal(true),
  customers: z.array(customerSchema),
}).strict();

const customerCatalogSchema = z.union([
  customerCatalogFixtureSchema,
  z.object({ customers: z.array(customerSchema) }).strict(),
]).transform(({ customers }) => ({ customers }));

export const customerEditorSchema = createCustomerSchema;

const normalizeText = (value: string) => value.trim().toLocaleLowerCase("es-AR");
const normalizePhone = (value: string) => value.replace(/\D/g, "");

export const authorizeCustomerCatalogData = (input: unknown): CustomerCatalogData =>
  customerCatalogSchema.parse(input);

export const filterCustomers = (customers: Customer[], query: string) => {
  const normalized = normalizeText(query);
  if (!normalized) return customers;
  const normalizedQueryPhone = normalizePhone(query);

  return customers.filter((customer) => {
    const searchable = normalizeText(
      `${customer.firstName} ${customer.lastName} ${customer.email ?? ""} ${customer.phone} ${normalizePhone(customer.phone)}`,
    );
    return searchable.includes(normalized)
      || (normalizedQueryPhone.length > 0
        && normalizePhone(customer.phone).includes(normalizedQueryPhone));
  });
};

export const sortCustomers = (customers: Customer[], sort: CustomerSort) => {
  const sorted = [...customers];
  if (sort === "visits-desc") return sorted.sort((a, b) => b.visits - a.visits);
  if (sort === "visits-asc") return sorted.sort((a, b) => a.visits - b.visits);
  if (sort === "newest") return sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (sort === "oldest") return sorted.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return sorted;
};

export const calculateCustomerMetrics = (customers: Customer[]): CustomerMetrics => {
  const latestMonth = customers
    .map((customer) => customer.createdAt.slice(0, 7))
    .sort()
    .at(-1);

  return {
    totalCustomers: customers.length,
    newCustomers: customers.filter((customer) => customer.createdAt.startsWith(latestMonth ?? "")).length,
    totalVisits: customers.reduce((total, customer) => total + customer.visits, 0),
  };
};

export const validateUniqueCustomerContact = (
  contact: Pick<CustomerEditorInput, "email" | "phone">,
  customers: Customer[],
  ignoredCustomerId?: string,
) => {
  const email = contact.email ? normalizeText(contact.email) : null;
  const phone = normalizePhone(contact.phone);
  const candidates = customers.filter((customer) => customer.id !== ignoredCustomerId);

  if (email && candidates.some((customer) => customer.email && normalizeText(customer.email) === email)) {
    return "Ya existe un cliente con ese email.";
  }
  if (candidates.some((customer) => normalizePhone(customer.phone) === phone)) {
    return "Ya existe un cliente con ese teléfono.";
  }
  return null;
};
