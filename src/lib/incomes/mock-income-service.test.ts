import { describe, expect, it } from "vitest";

import incomeFormMock from "@/data/income-form.mock.json";
import type { IncomeFormData } from "@/types/income";
import { createMockIncomeService } from "./mock-income-service";

const data = incomeFormMock as IncomeFormData;

const input = {
  employeeId: "employee-lautaro",
  customerId: null,
  serviceId: "service-haircut-eyebrows",
  products: [{ productId: "product-hair-wax", quantity: 2 }],
  paymentMethod: "cash" as const,
};

describe("createMockIncomeService", () => {
  it("creates an income and recalculates its catalog total", async () => {
    const service = createMockIncomeService(data);

    const income = await service.create(input);

    expect(income).toMatchObject({
      ...input,
      total: 39800,
    });
    expect(income.id).toEqual(expect.any(String));
    expect(Number.isNaN(Date.parse(income.createdAt))).toBe(false);
  });

  it("rejects with a stable message when failure mode is enabled", async () => {
    const service = createMockIncomeService(data, { shouldFail: true });

    await expect(service.create(input)).rejects.toThrow(
      "No se pudo registrar el ingreso.",
    );
  });
});
