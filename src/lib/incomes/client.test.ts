import { beforeEach, describe, expect, it, vi } from "vitest";
import { incomeClient } from "@/lib/incomes/client";

const fetchMock = vi.fn<typeof fetch>();

const managerListResponse = {
  data: {
    items: [],
    metrics: { grossTotal: 0, commissionTotal: 0, barbershopNet: 0, count: 0, average: 0, paymentTotals: [] },
    pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 },
  },
};

const managerDetailResponse = {
  data: {
    id: "20000000-0000-4000-8000-000000000001",
    createdAt: "2026-08-23T12:00:00.000Z",
    businessDate: "2026-08-23",
    employee: { id: "00000000-0000-4000-8000-000000000003", firstName: "Fer", lastName: "Pérez" },
    registeredBy: { id: "00000000-0000-4000-8000-000000000003", firstName: "Fer", lastName: "Pérez" },
    customer: null,
    service: null,
    products: [],
    payments: [{ paymentMethodId: "60000000-0000-4000-8000-000000000001", methodName: "Efectivo", amount: 13000 }],
    commission: { total: 0, barbershopNet: 0 },
    total: 13000,
    grossTotal: 13000,
    status: "active",
  },
};

const employeeListResponse = {
  data: {
    items: [
      {
        id: "20000000-0000-4000-8000-000000000001",
        createdAt: "2026-08-23T12:00:00.000Z",
        businessDate: "2026-08-23",
        customer: null,
        concepts: [{ id: "10000000-0000-4000-8000-000000000001", type: "service", name: "Corte", quantity: 1, earning: 5000 }],
        employeeCommission: 5000,
        status: "active",
      },
    ],
    metrics: { count: 1, employeeCommissionTotal: 5000 },
    pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
  },
};

const employeeDetailResponse = {
  data: {
    id: "20000000-0000-4000-8000-000000000001",
    createdAt: "2026-08-23T12:00:00.000Z",
    businessDate: "2026-08-23",
    customer: null,
    concepts: [{ id: "10000000-0000-4000-8000-000000000001", type: "service", name: "Corte", quantity: 1, earning: 5000 }],
    employeeCommission: 5000,
    status: "active",
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});

describe("incomeClient", () => {
  it("creates, lists, gets and voids incomes without caching", async () => {
    fetchMock.mockImplementation(async (url: string | URL | Request) => {
      const target = typeof url === "string" ? url : url.toString();
      if (target.endsWith("/void")) return Response.json(managerDetailResponse);
      if (target.includes("/api/incomes/")) return Response.json(managerDetailResponse);
      if (target.includes("/api/incomes")) return Response.json(managerListResponse);
      return Response.json({ data: {} });
    });
    const input = { requestId: "40000000-0000-4000-8000-000000000001", employeeId: "00000000-0000-4000-8000-000000000003", customerId: null, serviceId: "30000000-0000-4000-8000-000000000001", products: [{ productId: "50000000-0000-4000-8000-000000000001", quantity: 2, grantFullCommission: true }], payments: [{ paymentMethodId: "60000000-0000-4000-8000-000000000001", amount: 13000 }], grantFullServiceCommission: false };
    await incomeClient.create(input);
    await incomeClient.list({ page: 1, pageSize: 10, dateFrom: "2026-08-01", paymentMethodId: "60000000-0000-4000-8000-000000000003" });
    await incomeClient.get("20000000-0000-4000-8000-000000000001");
    await incomeClient.void("20000000-0000-4000-8000-000000000001");
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/incomes", expect.objectContaining({ method: "POST", cache: "no-store" }));
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string).products).toEqual(input.products);
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/incomes?page=1&pageSize=10&dateFrom=2026-08-01&paymentMethodId=60000000-0000-4000-8000-000000000003", { cache: "no-store" });
    expect(fetchMock).toHaveBeenNthCalledWith(4, "/api/incomes/20000000-0000-4000-8000-000000000001/void", { method: "POST", cache: "no-store" });
  });

  it("parses the list envelope with the manager schema when viewer is owner/admin", async () => {
    fetchMock.mockImplementation(async () => Response.json(managerListResponse));
    const result = await incomeClient.listAs("owner", { page: 1, pageSize: 10 });
    expect(result.items).toEqual([]);
    expect(result.metrics).toMatchObject({ grossTotal: 0 });
  });

  it("parses the list envelope with the sanitized employee schema when viewer is employee", async () => {
    fetchMock.mockImplementation(async () => Response.json(employeeListResponse));
    const result = await incomeClient.listAs("employee", { page: 1, pageSize: 10 });
    expect(result.items[0]).toMatchObject({ employeeCommission: 5000, concepts: [{ name: "Corte" }] });
    expect(result.metrics).toEqual({ count: 1, employeeCommissionTotal: 5000 });
  });

  it("parses the detail envelope with the manager schema when viewer is admin", async () => {
    fetchMock.mockImplementation(async () => Response.json(managerDetailResponse));
    const detail = await incomeClient.getAs("admin", "20000000-0000-4000-8000-000000000001");
    expect(detail).toMatchObject({ total: 13000 });
  });

  it("parses the detail envelope with the sanitized employee schema when viewer is employee", async () => {
    fetchMock.mockImplementation(async () => Response.json(employeeDetailResponse));
    const detail = await incomeClient.getAs("employee", "20000000-0000-4000-8000-000000000001");
    expect(detail).toMatchObject({ employeeCommission: 5000 });
    expect((detail as { total?: number }).total).toBeUndefined();
  });
});
