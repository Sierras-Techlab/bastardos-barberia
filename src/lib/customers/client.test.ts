import { beforeEach, expect, it, vi } from "vitest";
import { customerClient } from "@/lib/customers/client";

const customer = { id: "10000000-0000-4000-8000-000000000001", firstName: "Ana", lastName: "Pérez", phone: "3515550101", email: null, visits: 0, createdAt: "2026-08-11T10:00:00.000Z" };
const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("fetch", fetchMock); });

it("creates, edits and removes customers through JSON APIs", async () => {
  fetchMock.mockResolvedValueOnce(Response.json({ data: customer }, { status: 201 })).mockResolvedValueOnce(Response.json({ data: customer })).mockResolvedValueOnce(Response.json({ data: { id: customer.id } }));
  await customerClient.create({ firstName: "Ana", lastName: "Pérez", phone: customer.phone, email: null, fixedSchedule: null });
  await customerClient.update(customer.id, { firstName: "Anita" });
  await customerClient.remove(customer.id);
  expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/customers", expect.objectContaining({ body: JSON.stringify({ firstName: "Ana", lastName: "Pérez", phone: customer.phone, email: null, fixedSchedule: null }) }));
  expect(fetchMock).toHaveBeenNthCalledWith(2, `/api/customers/${customer.id}`, expect.objectContaining({ body: JSON.stringify({ firstName: "Anita" }) }));
  expect(fetchMock).toHaveBeenNthCalledWith(3, `/api/customers/${customer.id}`, { method: "DELETE" });
});

it("sends a configured schedule and preserves the server error", async () => {
  fetchMock.mockResolvedValueOnce(Response.json({ error: { code: "VALIDATION_ERROR", message: "Revisá los datos ingresados." } }, { status: 400 }));
  const promise = customerClient.create({ firstName: "Ana", lastName: "Pérez", phone: customer.phone, email: null, fixedSchedule: { weekday: 4, time: "10:00" } });
  await expect(promise).rejects.toThrow("Revisá los datos ingresados.");
  expect(fetchMock).toHaveBeenCalledWith("/api/customers", expect.objectContaining({ body: expect.stringContaining('"fixedSchedule":{"weekday":4,"time":"10:00"}') }));
});

it("preserves the explicit null used to disable a schedule", async () => {
  fetchMock.mockResolvedValueOnce(Response.json({ error: { code: "VALIDATION_ERROR", message: "Revisá los datos ingresados." } }, { status: 400 }));
  const promise = customerClient.update(customer.id, { fixedSchedule: null, expectedScheduleVersion: 1 });
  await expect(promise).rejects.toThrow("Revisá los datos ingresados.");
  expect(fetchMock).toHaveBeenCalledWith(`/api/customers/${customer.id}`, expect.objectContaining({ body: JSON.stringify({ fixedSchedule: null, expectedScheduleVersion: 1 }) }));
});

it("loads paginated visit details without caching", async () => {
  const visits = { items: [], pagination: { page: 2, pageSize: 20, total: 22, totalPages: 2 } };
  fetchMock.mockResolvedValueOnce(Response.json({ data: visits }));
  const controller = new AbortController();

  await expect(customerClient.listVisits(customer.id, { page: 2, pageSize: 20 }, controller.signal)).resolves.toEqual(visits);
  expect(fetchMock).toHaveBeenCalledWith(
    `/api/customers/${customer.id}/visits?page=2&pageSize=20`,
    { cache: "no-store", signal: controller.signal },
  );
});
