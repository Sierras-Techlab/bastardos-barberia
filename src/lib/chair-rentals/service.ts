import "server-only";
import { assertManager } from "@/lib/auth/authorization";
import { AppError } from "@/lib/auth/errors";
import type { SafeUser } from "@/lib/auth/types";
import type { EmployeeCommercialAgreement } from "@/types/chair-rental";
import { chairRentalRepository } from "./repository";
import type { ChairRentalDependencies } from "./contracts";
import type { ConfirmChairRentalInput, VoidChairRentalInput } from "./service-types";

const defaults: ChairRentalDependencies = { rentals: chairRentalRepository };
const assertOwner = (actor: SafeUser) => {
  if (actor.role.name !== "owner") throw new AppError("FORBIDDEN", "No tenés permisos para realizar esta acción.", 403);
};

export const getEmployeeAgreement = (actor: SafeUser, employeeId: string, dependencies = defaults) => {
  assertManager(actor);
  return dependencies.rentals.getAgreement(actor.id, employeeId);
};
export const updateEmployeeAgreement = (actor: SafeUser, employeeId: string, input: EmployeeCommercialAgreement, dependencies = defaults) => {
  assertOwner(actor);
  return dependencies.rentals.updateAgreement(actor.id, employeeId, input);
};
export const listChairRentals = (actor: SafeUser, query: { period?: string; status?: string; page: number; pageSize: number }, dependencies = defaults) => {
  assertManager(actor);
  return dependencies.rentals.list(actor.id, query);
};
export const getChairRentalDetail = (actor: SafeUser, employeeId: string, dependencies = defaults) => {
  assertManager(actor);
  return dependencies.rentals.detail(actor.id, employeeId);
};
export const confirmChairRental = (actor: SafeUser, employeeId: string, input: ConfirmChairRentalInput, dependencies = defaults) => {
  assertOwner(actor);
  return dependencies.rentals.confirm(actor.id, employeeId, input);
};
export const voidChairRental = (actor: SafeUser, paymentId: string, input: VoidChairRentalInput, dependencies = defaults) => {
  assertOwner(actor);
  return dependencies.rentals.void(actor.id, paymentId, input);
};
