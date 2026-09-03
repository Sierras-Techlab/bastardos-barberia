import { afterEach, expect, it, vi } from "vitest";

import { withIncomeLoadDeadline } from "@/lib/incomes/load-deadline";

afterEach(() => {
  vi.useRealTimers();
});

it("rejects an initial income-page load that does not settle", async () => {
  vi.useFakeTimers();
  const pending = new Promise<never>(() => undefined);
  const load = withIncomeLoadDeadline(pending);
  const rejection = expect(load).rejects.toThrow(
    "La carga inicial de ingresos tardó demasiado.",
  );

  await vi.advanceTimersByTimeAsync(15_000);
  await rejection;
});
