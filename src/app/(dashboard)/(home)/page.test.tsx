import { expect, it, vi } from "vitest";

const { requirePageUser } = vi.hoisted(() => ({
  requirePageUser: vi.fn().mockResolvedValue({
    user: { id: "user-id" },
  }),
}));

vi.mock("@/lib/auth/authorization", () => ({ requirePageUser }));

import Home from "./page";

it("revalidates the session at the dashboard boundary", async () => {
  await Home();

  expect(requirePageUser).toHaveBeenCalledOnce();
});

it("does not render the dashboard after session revocation", async () => {
  requirePageUser.mockRejectedValueOnce(new Error("revoked session"));

  await expect(Home()).rejects.toThrow("revoked session");
});
