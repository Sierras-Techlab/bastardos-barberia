import { assertManager } from "@/lib/auth/authorization";
import { AppError } from "@/lib/auth/errors";
import type { SafeUser } from "@/lib/auth/types";
import type { CustomerServiceDependencies } from "@/lib/customers/contracts";
import { customerRepository } from "@/lib/customers/repository";
import type { CreateCustomerInput, CustomerVisitQuery, UpdateCustomerInput } from "@/types/customer";
import type { FixedScheduleInput } from "@/types/fixed-customer";

const notFound = () => new AppError("CUSTOMER_NOT_FOUND", "No encontramos el cliente.", 404);
const defaults: CustomerServiceDependencies = { customers: customerRepository, now: () => new Date().toISOString() };
const isEmployee = (actor: SafeUser) => actor.role.name === "employee";
const forcedSelfSchedule = (actor: SafeUser, schedule: FixedScheduleInput): FixedScheduleInput => {
  if (schedule.responsibleUserId === actor.id) return schedule;
  return { ...schedule, responsibleUserId: actor.id };
};
const applyActorScheduleScope = (actor: SafeUser, schedule: FixedScheduleInput | null | undefined): FixedScheduleInput | null | undefined => {
  if (schedule === undefined || schedule === null) return schedule;
  return isEmployee(actor) ? forcedSelfSchedule(actor, schedule) : schedule;
};
export const listCustomers = async (actor: SafeUser, dependencies: CustomerServiceDependencies = defaults) => ({ customers: await dependencies.customers.list(actor.id) });
export const getLatestCustomer = async (_actor: SafeUser, dependencies: CustomerServiceDependencies = defaults) => dependencies.customers.latest();
export const createCustomer = async (actor: SafeUser, input: CreateCustomerInput, dependencies: CustomerServiceDependencies = defaults) =>
  dependencies.customers.create({ ...input, fixedSchedule: applyActorScheduleScope(actor, input.fixedSchedule) ?? null, createdBy: actor.id });
export const updateCustomer = async (actor: SafeUser, id: string, input: UpdateCustomerInput, dependencies: CustomerServiceDependencies = defaults) => {
  const customer = await dependencies.customers.update(id, { ...input, fixedSchedule: applyActorScheduleScope(actor, input.fixedSchedule), updatedBy: actor.id });
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
