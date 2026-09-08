import type {
  CashDay,
  CashHistoryQuery,
  ConfirmCashInput,
  PaginatedCashHistory,
  SetCashOpeningBalanceInput,
} from "@/types/cash";

export type CashRepository = {
  getDay(actorId: string, date: string): Promise<CashDay | null>;
  list(
    actorId: string,
    query: CashHistoryQuery,
  ): Promise<PaginatedCashHistory>;
  setOpeningBalance(
    actorId: string,
    input: SetCashOpeningBalanceInput & { businessDate: string },
  ): Promise<CashDay>;
  confirm(actorId: string, registerId: string, input: ConfirmCashInput): Promise<CashDay>;
};

export type CashDependencies = {
  cash: CashRepository;
};
