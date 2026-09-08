import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/cash/open", () => {
  it("rejects the removed manual opening operation", async () => {
    const response = await POST();
    expect(response.status).toBe(410);
    const body = await response.json();
    expect(body.error.code).toBe("CASH_MANUAL_LIFECYCLE_DISABLED");
  });
});
