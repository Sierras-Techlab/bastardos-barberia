import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireUser, listFixedCustomerMonths, payFixedCustomerMonth, getFixedCustomerMonth } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  listFixedCustomerMonths: vi.fn(),
  payFixedCustomerMonth: vi.fn(),
  getFixedCustomerMonth: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({ requireUser }));
vi.mock("@/lib/fixed-customer-payments/service", () => ({ listFixedCustomerMonths, payFixedCustomerMonth, getFixedCustomerMonth }));

import { AppError } from "@/lib/auth/errors";

import { GET as listRoute } from "./route";
import { POST as payRoute } from "./pay/route";
import { GET as getRoute } from "./get/route";

const ownerActor = { id: "00000000-0000-4000-8000-000000000001", role: { id: 1, name: "owner" } };
const employeeActor = { id: "00000000-0000-4000-8000-000000000003", role: { id: 3, name: "employee" } };

beforeEach(() => {
  vi.clearAllMocks();
  listFixedCustomerMonths.mockResolvedValue([]);
  payFixedCustomerMonth.mockResolvedValue({ viewer: "employee", period: "2026-08" });
  getFixedCustomerMonth.mockResolvedValue({ viewer: "manager", period: "2026-08" });
});

describe("GET /api/fixed-customer-months", () => {
  it("authorises the user before parsing the query", async () => {
    const callOrder: string[] = [];
    requireUser.mockImplementationOnce(async () => { callOrder.push("auth"); return { user: ownerActor }; });
    listFixedCustomerMonths.mockImplementationOnce(async () => { callOrder.push("service"); return []; });
    const response = await listRoute(new Request("http://localhost/api/fixed-customer-months?period=2026-08"));
    expect(response.status).toBe(200);
    expect(callOrder).toEqual(["auth", "service"]);
  });

  it("rejects an invalid period with a 400 response", async () => {
    requireUser.mockResolvedValueOnce({ user: ownerActor });
    const response = await listRoute(new Request("http://localhost/api/fixed-customer-months?period=2026-13"));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects a forbidden employee filter with a 403 response", async () => {
    requireUser.mockResolvedValueOnce({ user: employeeActor });
    listFixedCustomerMonths.mockRejectedValueOnce(new AppError("FORBIDDEN", "Solo podés ver tus propios clientes fijos.", 403));
    const response = await listRoute(new Request("http://localhost/api/fixed-customer-months?period=2026-08&employeeId=00000000-0000-4000-8000-000000000004"));
    expect(response.status).toBe(403);
  });
});

describe("POST /api/fixed-customer-months/pay", () => {
  it("forces the manager mode when the actor is an owner and forwards the payload", async () => {
    requireUser.mockResolvedValueOnce({ user: ownerActor });
    const body = {
      requestId: "00000000-0000-4000-8000-0000000000aa",
      customerId: "10000000-0000-4000-8000-000000000001",
      period: "2026-08",
      payments: [{ paymentMethodId: "00000000-0000-4000-8000-0000000000a1", amount: 15000 }],
    };
    const request = new Request("http://localhost/api/fixed-customer-months/pay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const response = await payRoute(request);
    expect(response.status).toBe(201);
    expect(payFixedCustomerMonth).toHaveBeenCalledWith(ownerActor, expect.objectContaining({ payments: [{ paymentMethodId: "00000000-0000-4000-8000-0000000000a1", amount: 15000 }] }));
  });

  it("forces the employee mode when the actor is an employee", async () => {
    requireUser.mockResolvedValueOnce({ user: employeeActor });
    const body = {
      requestId: "00000000-0000-4000-8000-0000000000aa",
      customerId: "10000000-0000-4000-8000-000000000001",
      period: "2026-08",
      payments: [{ paymentMethodId: "00000000-0000-4000-8000-0000000000a1", basisPoints: 10000 }],
    };
    const request = new Request("http://localhost/api/fixed-customer-months/pay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const response = await payRoute(request);
    expect(response.status).toBe(201);
    expect(payFixedCustomerMonth).toHaveBeenCalledWith(employeeActor, expect.objectContaining({ payments: [{ paymentMethodId: "00000000-0000-4000-8000-0000000000a1", basisPoints: 10000 }] }));
  });
});

describe("GET /api/fixed-customer-months/get", () => {
  it("returns the manager projection for an owner", async () => {
    requireUser.mockResolvedValueOnce({ user: ownerActor });
    const response = await getRoute(new Request("http://localhost/api/fixed-customer-months/get?customerId=10000000-0000-4000-8000-000000000001&period=2026-08"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.month.viewer).toBe("manager");
    expect(getFixedCustomerMonth).toHaveBeenCalledWith(ownerActor, "10000000-0000-4000-8000-000000000001", "2026-08");
  });

  it("returns a 404 when the month is missing", async () => {
    requireUser.mockResolvedValueOnce({ user: ownerActor });
    getFixedCustomerMonth.mockRejectedValueOnce(new AppError("FIXED_MONTH_NOT_FOUND", "No encontramos el mes del cliente.", 404));
    const response = await getRoute(new Request("http://localhost/api/fixed-customer-months/get?customerId=10000000-0000-4000-8000-000000000001&period=2026-08"));
    expect(response.status).toBe(404);
  });
});