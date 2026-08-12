import { beforeEach, expect, it, vi } from "vitest";
import { customerClient } from "@/lib/customers/client";

const customer = { id: "10000000-0000-4000-8000-000000000001", firstName: "Ana", lastName: "Pérez", phone: "3515550101", email: null, visits: 0, createdAt: "2026-08-11T10:00:00.000Z" };
const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("fetch", fetchMock); });

it("creates, edits and removes customers through JSON APIs", async () => {
  fetchMock.mockResolvedValueOnce(Response.json({ data: customer }, { status: 201 })).mockResolvedValueOnce(Response.json({ data: customer })).mockResolvedValueOnce(Response.json({ data: { id: customer.id } }));
  await customerClient.create({ firstName: "Ana", lastName: "Pérez", phone: customer.phone, email: null });
  await customerClient.update(customer.id, { firstName: "Anita" });
  await customerClient.remove(customer.id);
  expect(fetchMock).toHaveBeenNthCalledWith(3, `/api/customers/${customer.id}`, { method: "DELETE" });
});
