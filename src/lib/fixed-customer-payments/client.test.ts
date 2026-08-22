import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fixedCustomerPaymentClient } from "@/lib/fixed-customer-payments/client";

describe("fixed customer payment client", () => {
  const originalFetch = globalThis.fetch;
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("lists months via no-store GET and serialises filters", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200, headers: { "Content-Type": "application/json" } }));
    await fixedCustomerPaymentClient.list({ period: "2026-08", employeeId: "00000000-0000-4000-8000-000000000003" });
    const [url, init] = vi.mocked(globalThis.fetch).mock.calls[0]!;
    expect(url).toContain("/api/fixed-customer-months?");
    expect(url).toContain("period=2026-08");
    expect(url).toContain("employeeId=00000000-0000-4000-8000-000000000003");
    expect((init as RequestInit).cache).toBe("no-store");
  });

  it("sends a no-store POST and surfaces the server message on failure", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(new Response(JSON.stringify({ code: "FIXED_MONTH_ALREADY_PAID", message: "Ya cobrado." }), { status: 409, headers: { "Content-Type": "application/json" } }));
    await expect(fixedCustomerPaymentClient.pay({
      mode: "manager",
      requestId: "00000000-0000-4000-8000-0000000000aa",
      customerId: "10000000-0000-4000-8000-000000000001",
      period: "2026-08",
      payments: [{ paymentMethodId: "00000000-0000-4000-8000-0000000000a1", amount: 15000 }],
    })).rejects.toThrow("Ya cobrado.");
    const [, init] = vi.mocked(globalThis.fetch).mock.calls[0]!;
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).cache).toBe("no-store");
  });

  it("returns null on 404 when fetching a single month", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(new Response("Not Found", { status: 404 }));
    await expect(fixedCustomerPaymentClient.get("10000000-0000-4000-8000-000000000001", "2026-08")).resolves.toBeNull();
  });
});