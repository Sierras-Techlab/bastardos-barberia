import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/cash/close", () => {
  it("rejects the removed manual closing operation", async () => {
    const response = await POST();
    expect(response.status).toBe(410);
    const body = await response.json();
    expect(body.error.code).toBe("CASH_MANUAL_LIFECYCLE_DISABLED");
  });
});
