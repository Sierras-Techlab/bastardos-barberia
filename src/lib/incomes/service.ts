import { assertManager } from "@/lib/auth/authorization";
import { MANAGER_ROLES } from "@/lib/auth/constants";
import { AppError } from "@/lib/auth/errors";
import type { SafeUser } from "@/lib/auth/types";
import type { IncomeDependencies, IncomeScope } from "@/lib/incomes/contracts";
import { incomeRepository } from "@/lib/incomes/repository";
import type { CreateIncomeInput, IncomeListQuery } from "@/types/income";

const defaults: IncomeDependencies = { incomes: incomeRepository };
const scopeFor = (actor: SafeUser, requestedUserId?: string): IncomeScope => {
  const canViewAll = MANAGER_ROLES.has(actor.role.name);
  return { requestingUserId: actor.id, canViewAll, userId: canViewAll ? requestedUserId ?? null : actor.id };
};
const notFound = () => new AppError("INCOME_NOT_FOUND", "No encontramos el ingreso.", 404);
// Keep the submitted request canonical for idempotent retries. The atomic database
// function is the authoritative boundary that forces employees to themselves.
export const createIncome = (actor: SafeUser, input: CreateIncomeInput, dependencies: IncomeDependencies = defaults) =>
  dependencies.incomes.create(actor, input);
export const listIncomes = (actor: SafeUser, query: IncomeListQuery, dependencies: IncomeDependencies = defaults) => dependencies.incomes.list(scopeFor(actor, query.userId), query);
export const listIncomeResponsibleEmployees = (actor: SafeUser, dependencies: IncomeDependencies = defaults) => {
  assertManager(actor);
  return dependencies.incomes.listResponsibleEmployees(actor.id);
};
export const getIncome = async (actor: SafeUser, id: string, dependencies: IncomeDependencies = defaults) => { const income = await dependencies.incomes.findById(scopeFor(actor), id); if (!income) throw notFound(); return income; };
export const voidIncome = async (actor: SafeUser, id: string, dependencies: IncomeDependencies = defaults) => { assertManager(actor); const income = await dependencies.incomes.void(id, actor.id); if (!income) throw notFound(); return income; };
