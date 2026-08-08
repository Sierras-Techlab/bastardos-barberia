import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireManager, listUsers, createUser } = vi.hoisted(() => ({
  requireManager: vi.fn(),
  listUsers: vi.fn(),
  createUser: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({ requireManager }));
vi.mock("@/lib/users/service", () => ({ listUsers, createUser }));

import { GET, POST } from "./route";

describe("/api/admin/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireManager.mockResolvedValue({ user: { id: "manager-1" } });
  });

  it("validates filters and lists users as a manager", async () => {
    listUsers.mockResolvedValue({ items: [], page: 2, pageSize: 10, total: 0, totalPages: 0 });

    const response = await GET(new Request("http://localhost/api/admin/users?page=2&pageSize=10&status=active"));

    expect(listUsers).toHaveBeenCalledWith(
      { id: "manager-1" },
      { page: 2, pageSize: 10, status: "active" },
    );
    expect(response.status).toBe(200);
  });

  it("creates users with an explicit password", async () => {
    createUser.mockResolvedValue({ id: "new-user", username: "grace.hopper" });
    const body = { firstName: "Grace", lastName: "Hopper", password: "safe-password", roleId: 3 };

    const response = await POST(new Request("http://localhost/api/admin/users", {
      method: "POST",
      body: JSON.stringify(body),
    }));

    expect(createUser).toHaveBeenCalledWith({ id: "manager-1" }, body);
    expect(response.status).toBe(201);
  });
});
