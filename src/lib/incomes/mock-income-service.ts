import type {
  IncomeFormData,
  IncomeService,
} from "@/types/income";
import { calculateIncomeTotal } from "./income-calculations";

type MockIncomeServiceOptions = {
  shouldFail?: boolean;
  latencyMs?: number;
};

const wait = (duration: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, duration);
  });

export const createMockIncomeService = (
  data: IncomeFormData,
  options: MockIncomeServiceOptions = {},
): IncomeService => ({
  create: async (input) => {
    if (options.latencyMs) {
      await wait(options.latencyMs);
    }

    if (options.shouldFail) {
      throw new Error("No se pudo registrar el ingreso.");
    }

    return {
      ...input,
      id: crypto.randomUUID(),
      total: calculateIncomeTotal(input, data.services, data.products),
      createdAt: new Date().toISOString(),
    };
  },
});
