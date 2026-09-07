import { afterEach, describe, expect, it, vi } from "vitest";

import * as cashService from "@/lib/cash/service";
import type { SafeUser } from "@/lib/auth/types";

const user = (role: "owner" | "admin" | "employee"): SafeUser => ({
  id: "00000000-0000-4000-8000-000000000001",
  firstName: "Uriel",
  lastName: "Alessandro",
  username: "uriel.alessandro",
  role: { id: role === "owner" ? 1 : role === "admin" ? 2 : 3, name: role },
  isActive: true,
  serviceCommissionRate: 0,
  productCommissionRate: 0,
  lastLoginAt: null,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
});

describe("cash service", () => {
  afterEach(() => vi.useRealTimers());

  it("rejects an employee before touching the cash repository", async () => {
    const getDay = vi.fn();

    await expect(
      cashService.getCashDay(user("employee"), "2026-08-15", {
        cash: {
          getDay,
          list: vi.fn(),
          setOpeningBalance: vi.fn(),
          confirm: vi.fn(),
        },
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
    expect(getDay).not.toHaveBeenCalled();
  });

  it("uses only the authenticated manager id for day and history reads", async () => {
    const manager = user("owner");
    const getDay = vi.fn().mockResolvedValue({ id: null });
    const list = vi.fn().mockResolvedValue({ items: [] });
    const dependencies = { cash: { getDay, list, setOpeningBalance: vi.fn(), confirm: vi.fn() } };

    await cashService.getCashDay(manager, "2026-08-15", dependencies);
    await cashService.listCashHistory(
      manager,
      { page: 1, pageSize: 10 },
      dependencies,
    );

    expect(getDay).toHaveBeenCalledWith(manager.id, "2026-08-15");
    expect(list).toHaveBeenCalledWith(manager.id, { page: 1, pageSize: 10 });
  });

  it("sets today's opening balance with only the authenticated manager identity", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-15T15:00:00.000Z"));
    const setOpeningBalance = vi.fn().mockResolvedValue({ id: "cash" });
    const dependencies = {
      cash: {
        getDay: vi.fn(),
        list: vi.fn(),
        setOpeningBalance,
        confirm: vi.fn(),
      },
    };
    await cashService.setCashOpeningBalance(
      user("owner"),
      { openingBalance: 15000 },
      dependencies,
    );

    expect(setOpeningBalance).toHaveBeenCalledWith(user("owner").id, {
      businessDate: "2026-08-15",
      openingBalance: 15000,
    });
  });
});
