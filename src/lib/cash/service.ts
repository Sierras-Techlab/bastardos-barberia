import { assertManager } from "@/lib/auth/authorization";
import { AppError } from "@/lib/auth/errors";
import type { SafeUser } from "@/lib/auth/types";
import type { CashDependencies } from "@/lib/cash/contracts";
import { cashRepository } from "@/lib/cash/repository";
import type {
  CashHistoryQuery,
  ConfirmCashInput,
  SetCashOpeningBalanceInput,
} from "@/types/cash";

const defaults: CashDependencies = { cash: cashRepository };

const cashNotFound = () =>
  new AppError(
    "CASH_NOT_FOUND",
    "No hay una caja registrada para esa fecha.",
    404,
  );

const currentBuenosAiresDate = (): string => {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" });
  return formatter.format(now);
};

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

export const setCashOpeningBalance = (
  actor: SafeUser,
  input: SetCashOpeningBalanceInput,
  dependencies: CashDependencies = defaults,
) => {
  assertManager(actor);
  return dependencies.cash.setOpeningBalance(actor.id, {
    ...input,
    businessDate: currentBuenosAiresDate(),
  });
};

export const confirmCash = async (
  actor: SafeUser,
  registerId: string,
  input: ConfirmCashInput,
  dependencies: CashDependencies = defaults,
) => {
  assertManager(actor);
  return dependencies.cash.confirm(actor.id, registerId, input);
};
