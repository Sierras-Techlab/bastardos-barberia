import type { SafeUser } from "@/lib/auth/types";
import { fixedCustomerRepository } from "./repository";
import type { FixedCustomerDependencies } from "./contracts";
import type { FixedOccurrenceQuery, ResolveFixedOccurrenceInput } from "@/types/fixed-customer";

const defaults: FixedCustomerDependencies = { occurrences: fixedCustomerRepository };
export const listFixedOccurrences = (actor: SafeUser, query: FixedOccurrenceQuery, dependencies: FixedCustomerDependencies = defaults) =>
  dependencies.occurrences.list(actor.id, query);
export const resolveFixedOccurrence = (actor: SafeUser, id: string, input: ResolveFixedOccurrenceInput, dependencies: FixedCustomerDependencies = defaults) =>
  dependencies.occurrences.resolve(actor.id, id, input);
