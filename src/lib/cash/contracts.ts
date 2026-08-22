import type {
  CashDay,
  CashHistoryQuery,
  CloseCashInput,
  ConfirmCashInput,
  OpenCashInput,
  PaginatedCashHistory,
} from "@/types/cash";

export type CashRepository = {
  getDay(actorId: string, date: string): Promise<CashDay | null>;
  list(
    actorId: string,
    query: CashHistoryQuery,
  ): Promise<PaginatedCashHistory>;
  open(actorId: string, input: OpenCashInput & { businessDate: string }): Promise<CashDay>;
  close(actorId: string, input: CloseCashInput & { businessDate: string }): Promise<CashDay>;
  confirm(actorId: string, registerId: string, input: ConfirmCashInput): Promise<CashDay>;
};

export type CashDependencies = {
  cash: CashRepository;
};
