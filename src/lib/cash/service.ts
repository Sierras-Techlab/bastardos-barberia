import { assertManager } from "@/lib/auth/authorization";
import { AppError } from "@/lib/auth/errors";
import type { SafeUser } from "@/lib/auth/types";
import type { CashDependencies } from "@/lib/cash/contracts";
import { cashRepository } from "@/lib/cash/repository";
import type { CashHistoryQuery } from "@/types/cash";

const defaults: CashDependencies = { cash: cashRepository };

const cashNotFound = () =>
  new AppError(
    "CASH_NOT_FOUND",
    "No hay una caja registrada para esa fecha.",
    404,
  );

export const getCashDay = async (
  actor: SafeUser,
  date: string,
  dependencies: CashDependencies = defaults,
) => {
  assertManager(actor);
  const cash = await dependencies.cash.getDay(actor.id, date);
  if (!cash) throw cashNotFound();
  return cash;
};

export const listCashHistory = (
  actor: SafeUser,
  query: CashHistoryQuery,
  dependencies: CashDependencies = defaults,
) => {
  assertManager(actor);
  return dependencies.cash.list(actor.id, query);
};
