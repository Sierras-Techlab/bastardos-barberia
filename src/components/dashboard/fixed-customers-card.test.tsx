import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { FixedCustomersCard } from "@/components/dashboard/fixed-customers-card";
import type { FixedCustomerOccurrence } from "@/types/fixed-customer";

const occurrences: FixedCustomerOccurrence[] = [
  { id: "occ-2", customer: { id: "customer-2", firstName: "Pedro", lastName: "Castañeda" }, date: "2026-11-12", time: "16:00", status: "missed" },
  { id: "occ-1", customer: { id: "customer-1", firstName: "Juan", lastName: "Cruz" }, date: "2026-11-12", time: "14:30", status: "pending" },
  { id: "occ-3", customer: { id: "customer-3", firstName: "Ana", lastName: "Pérez" }, date: "2026-11-13", time: "09:00", status: "attended" },
];
const referenceInstant = "2026-11-12T18:00:00.000Z";
const futurePending: FixedCustomerOccurrence = { id: "occ-future", customer: { id: "customer-future", firstName: "Pedro", lastName: "Castañeda" }, date: "2026-11-12", time: "16:00", status: "pending" };

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => vi.useRealTimers());

it("sorts fixed occurrences and renders their current states", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(referenceInstant));
  const { container } = render(<FixedCustomersCard occurrences={occurrences} referenceInstant={referenceInstant} />);
  const surface = container.querySelector("section");
  expect(surface).toHaveClass("rounded-3xl", "border", "border-border", "bg-card");
  expect(surface?.className).toMatch(/\bshadow-/);
  const rows = screen.getAllByRole("listitem");
  expect(within(rows[0]).getByText("Juan Cruz")).toBeVisible();
  expect(within(rows[1]).getByText("Pedro Castañeda")).toBeVisible();
  expect(within(rows[2]).getByText("Ana Pérez")).toBeVisible();
  expect(within(rows[0]).getByRole("button", { name: "Marcar ausencia de Juan Cruz" })).toHaveTextContent("No asistió");
  expect(within(rows[0]).getByRole("button", { name: "Marcar asistencia de Juan Cruz" })).toHaveTextContent("Asistió");
  expect(within(rows[1]).getByText("No asistió")).toBeVisible();
  expect(within(rows[2]).getByText("Asistió")).toBeVisible();
  expect(screen.getByRole("link", { name: "Gestionar clientes fijos" })).toHaveAttribute("href", "/customers");
  expect(screen.getByRole("heading", { name: "Sin registrar" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Resueltas" })).toBeVisible();
});

it("changes only the selected pending occurrence", async () => {
  const user = userEvent.setup();
  const onStatusChange = vi.fn();
  vi.useFakeTimers({ toFake: ["Date"] });
  const now = new Date(referenceInstant);
  vi.setSystemTime(now);
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const todayOccurrences = occurrences.map((occurrence) => ({ ...occurrence, date }));
  render(<FixedCustomersCard occurrences={todayOccurrences} referenceInstant={now.toISOString()} onStatusChange={onStatusChange} />);
  await user.click(screen.getByRole("button", { name: "Marcar asistencia de Juan Cruz" }));
  expect(onStatusChange).toHaveBeenCalledWith("occ-1", "attended");
  expect(screen.queryByRole("button", { name: "Marcar asistencia de Juan Cruz" })).not.toBeInTheDocument();
  expect(screen.getByText("Juan Cruz").closest("li")).toHaveTextContent("Asistió");
  expect(screen.getByText("Pedro Castañeda").closest("li")).toHaveTextContent("No asistió");
});

it("reclassifies a pending visit after its scheduled time and keeps its actions", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(referenceInstant));
  const { rerender } = render(<FixedCustomersCard occurrences={[futurePending]} referenceInstant={referenceInstant} />);
  expect(screen.getByRole("heading", { name: "Próximas" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Marcar asistencia de Pedro Castañeda" })).toBeVisible();

  rerender(<FixedCustomersCard occurrences={[futurePending]} referenceInstant="2026-11-12T19:00:00.000Z" />);

  expect(screen.getByRole("heading", { name: "Sin registrar" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Marcar asistencia de Pedro Castañeda" })).toBeVisible();
});

it("reclassifies an upcoming visit on the local minute boundary while the page stays open", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-12T17:59:45.000Z"));
  const visit: FixedCustomerOccurrence = { ...futurePending, time: "15:00" };
  render(<FixedCustomersCard occurrences={[visit]} referenceInstant="2026-11-12T17:59:45.000Z" />);
  expect(screen.getByRole("heading", { name: "Próximas" })).toBeVisible();

  await act(async () => { await vi.advanceTimersByTimeAsync(15_026); });

  expect(screen.getByRole("heading", { name: "Sin registrar" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Marcar asistencia de Pedro Castañeda" })).toBeVisible();
});

it("renders a useful empty state", () => {
  render(<FixedCustomersCard occurrences={[]} />);
  expect(screen.getByText("No hay turnos fijos para el resto de la semana")).toBeVisible();
  expect(screen.getByRole("link", { name: "Gestionar clientes" })).toHaveAttribute("href", "/customers");
});

it("refreshes once when Sunday SSR mounts just after Monday midnight in Buenos Aires", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-16T03:00:01.000Z"));
  render(<FixedCustomersCard occurrences={[]} referenceInstant="2026-11-16T02:59:59.000Z" />);
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });

  expect(refresh).toHaveBeenCalledOnce();
  expect(screen.getByText("No hay turnos fijos para el resto de la semana")).toBeVisible();
});
