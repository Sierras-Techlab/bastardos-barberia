import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionCookie, getCurrentSession, requestScope } = vi.hoisted(() => ({
  getSessionCookie: vi.fn().mockResolvedValue("session-token"),
  getCurrentSession: vi.fn().mockResolvedValue({
    sessionId: "session-id",
    expiresAt: "2026-08-09T00:00:00.000Z",
    user: { role: { id: 1, name: "owner" } },
  }),
  requestScope: { id: 0 },
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    cache: <T,>(loader: () => Promise<T>) => {
      let requestId = -1;
      let result: Promise<T> | undefined;
      return () => {
        if (requestId !== requestScope.id) {
          requestId = requestScope.id;
          result = loader();
        }
        return result;
      };
    },
  };
});
vi.mock("./cookie", () => ({ getSessionCookie }));
vi.mock("./session", () => ({ getCurrentSession }));

import { requireManager, requireUser } from "./authorization";

describe("request authentication memoization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requestScope.id += 1;
  });

  it("shares one session lookup between the private layout and a role guard", async () => {
    await Promise.all([requireUser(), requireManager()]);

    expect(getSessionCookie).toHaveBeenCalledOnce();
    expect(getCurrentSession).toHaveBeenCalledOnce();
  });

  it("performs a fresh lookup for a later server request", async () => {
    await requireUser();
    requestScope.id += 1;
    await requireUser();

    expect(getSessionCookie).toHaveBeenCalledTimes(2);
    expect(getCurrentSession).toHaveBeenCalledTimes(2);
  });
});
