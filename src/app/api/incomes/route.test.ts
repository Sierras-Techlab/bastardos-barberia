import { beforeEach, expect, it, vi } from "vitest";
import { AppError } from "@/lib/auth/errors";
const { requireUser, listIncomes, createIncome } = vi.hoisted(() => ({ requireUser: vi.fn(), listIncomes: vi.fn(), createIncome: vi.fn() }));
vi.mock("@/lib/auth/authorization", () => ({ requireUser })); vi.mock("@/lib/incomes/service", () => ({ listIncomes, createIncome }));
import { GET, POST } from "./route";
const actor = { id: "00000000-0000-4000-8000-000000000001", role: { id: 1, name: "owner" as const } };
beforeEach(() => { vi.clearAllMocks(); requireUser.mockResolvedValue({ user: actor }); });
it("parses list query and public create body", async () => {
  listIncomes.mockResolvedValue({ items: [] }); createIncome.mockResolvedValue({ id: "id" });
  await GET(new Request("http://localhost/api/incomes?page=2&pageSize=10&paymentMethodId=60000000-0000-4000-8000-000000000003"));
  expect(listIncomes).toHaveBeenCalledWith(actor, { page: 2, pageSize: 10, paymentMethodId: "60000000-0000-4000-8000-000000000003" });
  const input = { requestId: "40000000-0000-4000-8000-000000000001", employeeId: "00000000-0000-4000-8000-000000000003", customerId: null, serviceId: "30000000-0000-4000-8000-000000000001", products: [], payments: [{ paymentMethodId: "60000000-0000-4000-8000-000000000001", amount: 13000 }], grantFullServiceCommission: false };
  expect((await POST(new Request("http://localhost/api/incomes", { method: "POST", body: JSON.stringify(input) }))).status).toBe(201);
  expect(createIncome).toHaveBeenCalledWith(actor, input);
});

it("preserves the work-session conflict returned by income creation", async () => {
  createIncome.mockRejectedValue(
    new AppError(
      "EMPLOYEE_WORK_SESSION_REQUIRED",
      "Iniciá tu jornada antes de registrar una venta.",
      409,
    ),
  );

  const input = {
    requestId: "40000000-0000-4000-8000-000000000001",
    employeeId: "00000000-0000-4000-8000-000000000003",
    customerId: null,
    serviceId: "30000000-0000-4000-8000-000000000001",
    products: [],
    payments: [
      {
        paymentMethodId: "60000000-0000-4000-8000-000000000001",
        amount: 13000,
      },
    ],
    grantFullServiceCommission: false,
  };
  const response = await POST(
    new Request("http://localhost/api/incomes", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  );

  expect(response.status).toBe(409);
  await expect(response.json()).resolves.toEqual({
    error: {
      code: "EMPLOYEE_WORK_SESSION_REQUIRED",
      message: "Iniciá tu jornada antes de registrar una venta.",
    },
  });
});
