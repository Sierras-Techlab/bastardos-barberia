import { assertManager } from "@/lib/auth/authorization";
import { AppError } from "@/lib/auth/errors";
import type { SafeUser } from "@/lib/auth/types";
import type { CustomerServiceDependencies } from "@/lib/customers/contracts";
import { customerRepository } from "@/lib/customers/repository";
import type { CreateCustomerInput, CustomerVisitQuery, UpdateCustomerInput } from "@/types/customer";

const notFound = () => new AppError("CUSTOMER_NOT_FOUND", "No encontramos el cliente.", 404);
const defaults: CustomerServiceDependencies = { customers: customerRepository, now: () => new Date().toISOString() };
export const listCustomers = async (_actor: SafeUser, dependencies: CustomerServiceDependencies = defaults) => ({ customers: await dependencies.customers.list() });
export const getLatestCustomer = async (_actor: SafeUser, dependencies: CustomerServiceDependencies = defaults) => dependencies.customers.latest();
export const createCustomer = async (actor: SafeUser, input: CreateCustomerInput, dependencies: CustomerServiceDependencies = defaults) =>
  dependencies.customers.create({ ...input, createdBy: actor.id });
export const updateCustomer = async (actor: SafeUser, id: string, input: UpdateCustomerInput, dependencies: CustomerServiceDependencies = defaults) => {
  const customer = await dependencies.customers.update(id, { ...input, updatedBy: actor.id });
  if (!customer) throw notFound();
  return customer;
};
export const deleteCustomer = async (actor: SafeUser, id: string, dependencies: CustomerServiceDependencies = defaults) => {
  assertManager(actor);
  const deletedId = await dependencies.customers.softDelete(id, actor.id, (dependencies.now ?? defaults.now!)());
  if (!deletedId) throw notFound();
  return { id: deletedId };
};
export const listCustomerVisits = async (actor: SafeUser, id: string, query: CustomerVisitQuery, dependencies: CustomerServiceDependencies = defaults) =>
  dependencies.customers.listVisits(actor.id, id, query);
