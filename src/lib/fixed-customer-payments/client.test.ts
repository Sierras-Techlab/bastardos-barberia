import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FixedCustomerPaymentApiError, fixedCustomerPaymentClient } from "@/lib/fixed-customer-payments/client";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const month = {
  viewer: "manager",
  customer: { id: "10000000-0000-4000-8000-000000000001", firstName: "Tomás", lastName: "Pereyra" },
  responsibleProfessional: { id: "20000000-0000-4000-8000-000000000001", firstName: "Fer", lastName: "Pérez" },
  period: "2026-08",
  status: "pending",
  paidAt: null,
  incomeId: null,
  employeeEarning: 0,
  monthlyPrice: 15000,
};

describe("fixed customer payment client", () => {
  const originalFetch = globalThis.fetch;
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("lists months via no-store GET and parses the strict envelope", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(jsonResponse({ data: { items: [month] } }));
    const result = await fixedCustomerPaymentClient.list({ period: "2026-08", employeeId: "00000000-0000-4000-8000-000000000003" });
    expect(result).toEqual([month]);
    const [url, init] = vi.mocked(globalThis.fetch).mock.calls[0]!;
    expect(url).toContain("/api/fixed-customer-months?");
    expect(url).toContain("period=2026-08");
    expect(url).toContain("employeeId=00000000-0000-4000-8000-000000000003");
    expect((init as RequestInit).cache).toBe("no-store");
  });

  it("sends a no-store POST, parses the strict envelope, and raises FixedCustomerPaymentApiError with status/code/message on failure", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(jsonResponse({ error: { code: "FIXED_MONTH_ALREADY_PAID", message: "Ya cobrado." } }, 409));
    const call = fixedCustomerPaymentClient.pay({
      mode: "manager",
      requestId: "00000000-0000-4000-8000-0000000000aa",
      customerId: "10000000-0000-4000-8000-000000000001",
      period: "2026-08",
      payments: [{ paymentMethodId: "00000000-0000-4000-8000-0000000000a1", amount: 15000 }],
    });
    await expect(call).rejects.toBeInstanceOf(FixedCustomerPaymentApiError);
    await expect(call).rejects.toMatchObject({ status: 409, code: "FIXED_MONTH_ALREADY_PAID", message: "Ya cobrado." });
    const [, init] = vi.mocked(globalThis.fetch).mock.calls[0]!;
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).cache).toBe("no-store");
  });

  it("returns null on 404 when fetching a single month and parses the envelope otherwise", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(new Response("Not Found", { status: 404 }));
    await expect(fixedCustomerPaymentClient.get("10000000-0000-4000-8000-000000000001", "2026-08")).resolves.toBeNull();
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(jsonResponse({ data: { month } }));
    const result = await fixedCustomerPaymentClient.get("10000000-0000-4000-8000-000000000001", "2026-08");
    expect(result).toEqual(month);
  });

  it("preserves integer ARS values without /100 or *100 conversions", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(jsonResponse({ data: { month } }));
    await fixedCustomerPaymentClient.pay({
      mode: "manager",
      requestId: "00000000-0000-4000-8000-0000000000aa",
      customerId: "10000000-0000-4000-8000-000000000001",
      period: "2026-08",
      payments: [{ paymentMethodId: "00000000-0000-4000-8000-0000000000a1", amount: 15000 }],
    });
    const body = JSON.parse((vi.mocked(globalThis.fetch).mock.calls[0]![1] as RequestInit).body as string);
    expect(body.payments[0].amount).toBe(15000);
  });
});