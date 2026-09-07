import { beforeEach, describe, expect, it, vi } from "vitest";

import { CashApiError, cashClient } from "@/lib/cash/client";

const fetchMock = vi.fn<typeof fetch>();

describe("cashClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("reads day and history without caching and exposes only supported mutations", async () => {
    fetchMock.mockImplementation(async () => Response.json({ data: {} }));

    await cashClient.getDay("2026-08-15");
    await cashClient.list({
      dateFrom: "2026-08-01",
      dateTo: "2026-08-15",
      page: 2,
      pageSize: 10,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/cash?date=2026-08-15",
      { cache: "no-store" },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/cash/history?dateFrom=2026-08-01&dateTo=2026-08-15&page=2&pageSize=10",
      { cache: "no-store" },
    );
    expect(Object.keys(cashClient).sort()).toEqual(["confirm", "getDay", "list", "setOpeningBalance"]);
  });

  it("sends an opening-balance update to its dedicated endpoint", async () => {
    fetchMock.mockImplementation(async () => Response.json({ data: {} }));

    await (cashClient as typeof cashClient & {
      setOpeningBalance(input: { openingBalance: number }): Promise<unknown>;
    }).setOpeningBalance({ openingBalance: 15000 });

    expect(fetchMock).toHaveBeenCalledWith("/api/cash/opening-balance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ openingBalance: 15000 }),
      cache: "no-store",
    });
  });

  it("preserves the public API error contract", async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        { error: { code: "CASH_NOT_FOUND", message: "Sin actividad." } },
        { status: 404 },
      ),
    );

    await expect(cashClient.getDay("2026-08-01")).rejects.toEqual(
      new CashApiError(404, "CASH_NOT_FOUND", "Sin actividad."),
    );
  });
});
