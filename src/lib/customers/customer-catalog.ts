import { z } from "zod";

import type {
  Customer,
  CustomerCatalogData,
  CustomerEditorInput,
  CustomerMetrics,
  CustomerSort,
} from "@/types/customer";

const customerSchema = z.object({
  id: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.email(),
  phone: z.string().min(1),
  visits: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
}).strict();

const customerCatalogSchema = z.object({
  isMock: z.literal(true),
  customers: z.array(customerSchema),
}).strict();

export const customerEditorSchema = z.object({
  firstName: z.string().trim().min(1, "Ingresá el nombre."),
  lastName: z.string().trim().min(1, "Ingresá el apellido."),
  email: z.string().trim().toLowerCase().pipe(
    z.email("Ingresá un email válido, sin ñ ni acentos."),
  ),
  phone: z.string().trim().refine(
    (value) => value.replace(/\D/g, "").length >= 8,
    "Ingresá un teléfono válido.",
  ),
});

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
      `${customer.firstName} ${customer.lastName} ${customer.email} ${customer.phone} ${normalizePhone(customer.phone)}`,
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
  const email = normalizeText(contact.email);
  const phone = normalizePhone(contact.phone);
  const candidates = customers.filter((customer) => customer.id !== ignoredCustomerId);

  if (candidates.some((customer) => normalizeText(customer.email) === email)) {
    return "Ya existe un cliente con ese email.";
  }
  if (candidates.some((customer) => normalizePhone(customer.phone) === phone)) {
    return "Ya existe un cliente con ese teléfono.";
  }
  return null;
};
