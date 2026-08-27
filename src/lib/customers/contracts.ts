import type { CreateCustomerInput, Customer, CustomerVisitQuery, PaginatedCustomerVisits, UpdateCustomerInput } from "@/types/customer";

export type CustomerCreateRecord = CreateCustomerInput & { createdBy: string };
export type CustomerUpdateRecord = UpdateCustomerInput & { updatedBy: string };
export type CustomerRepository = {
  list(actorId: string): Promise<Customer[]>;
  latest(): Promise<Customer | null>;
  findById(id: string): Promise<Customer | null>;
  findByNormalizedPhone(phone: string): Promise<Customer | null>;
  create(input: CustomerCreateRecord): Promise<Customer>;
  update(id: string, changes: CustomerUpdateRecord): Promise<Customer | null>;
  softDelete(id: string, actorId: string, at: string): Promise<string | null>;
  listVisits(actorId: string, customerId: string, query: CustomerVisitQuery): Promise<PaginatedCustomerVisits>;
};
export type CustomerServiceDependencies = {
  customers: CustomerRepository;
  now?: () => string;
};
