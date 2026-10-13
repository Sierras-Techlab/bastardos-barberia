import { beforeEach, describe, expect, it, vi } from "vitest";

import { chairRentalClient } from "./client";

const payment = {
  id: "00000000-0000-4000-8000-000000000001",
  employeeId: "00000000-0000-4000-8000-000000000002",
  employeeName: "Lucía Ferreyra",
  period: "2026-10",
  amount: 10000,
  status: "paid" as const,
  paymentMethodId: "00000000-0000-4000-8000-000000000003",
  paymentMethodName: "Efectivo",
  confirmedBy: { id: "00000000-0000-4000-8000-000000000004", firstName: "Ana", lastName: "García" },
  paidAt: "2026-10-02T12:00:00.000Z",
  businessDate: "2026-10-02",
  incomeId: "00000000-0000-4000-8000-000000000005",
  voidedAt: null,
  voidedBy: null,
  voidReason: null,
};

describe("chairRentalClient", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("sends only the idempotent confirmation contract", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: payment }), { status: 200 }));
    await chairRentalClient.confirm(payment.employeeId, { period: payment.period, paymentMethodId: payment.paymentMethodId!, requestId: "00000000-0000-4000-8000-000000000006" });
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(String(init?.body))).toEqual({ period: "2026-10", paymentMethodId: payment.paymentMethodId, requestId: "00000000-0000-4000-8000-000000000006" });
  });

  it("rejects malformed successful responses before the UI uses them", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: { ...payment, amount: 10.5 } }), { status: 200 }));
    await chairRentalClient.detail(payment.employeeId).then(
      () => { throw new Error("Expected the malformed response to be rejected."); },
      (error: unknown) => expect(error).toMatchObject({ code: "INVALID_RESPONSE" }),
    );
  });
});
