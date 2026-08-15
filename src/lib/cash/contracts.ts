import type {
  CashDay,
  CashHistoryQuery,
  PaginatedCashHistory,
} from "@/types/cash";

export type CashRepository = {
  getDay(actorId: string, date: string): Promise<CashDay | null>;
  list(
    actorId: string,
    query: CashHistoryQuery,
  ): Promise<PaginatedCashHistory>;
};

export type CashDependencies = {
  cash: CashRepository;
};

