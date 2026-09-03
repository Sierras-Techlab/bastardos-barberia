import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

import { DashboardToaster } from "@/components/ui/dashboard-toaster";
import type { EmployeeWorkSession } from "@/types/work-session";
import { WorkSessionControl } from "./work-session-control";

const openSession: EmployeeWorkSession = {
  id: "70000000-0000-4000-8000-000000000001",
  employee: {
    id: "00000000-0000-4000-8000-000000000003",
    firstName: "Fernanda",
    lastName: "Pérez",
  },
  businessDate: "2026-08-21",
  startedAt: "2026-08-21T10:00:00.000Z",
  endedAt: null,
  updatedAt: "2026-08-21T10:00:00.000Z",
  state: "open",
  metrics: { workedMinutes: 95, saleCount: 2, employeeCommission: 9000 },
};

afterEach(() => {
  vi.useRealTimers();
});

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

it("minimizes the mobile control into a compact clock bubble", async () => {
  const browser = userEvent.setup();
  render(<WorkSessionControl initialSession={null} />);

  await browser.click(
    screen.getByRole("button", { name: "Minimizar control de jornada" }),
  );

  expect(
    screen.getByRole("button", { name: "Abrir control de jornada" }),
  ).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Marcar entrada" }),
  ).not.toBeInTheDocument();
});

it("drags the minimized bubble and snaps it to the nearest mobile side", async () => {
  Object.defineProperty(window, "innerWidth", { value: 390, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: 844, configurable: true });
  const browser = userEvent.setup();
  render(<WorkSessionControl initialSession={null} />);
  await browser.click(
    screen.getByRole("button", { name: "Minimizar control de jornada" }),
  );

  const bubble = screen.getByRole("button", { name: "Abrir control de jornada" });
  fireEvent.pointerDown(bubble, { pointerId: 1, clientX: 30, clientY: 650 });
  fireEvent.pointerMove(bubble, { pointerId: 1, clientX: 370, clientY: 220 });
  fireEvent.pointerUp(bubble, { pointerId: 1, clientX: 370, clientY: 220 });

  const control = screen.getByRole("complementary", { name: "Control de jornada" });
  expect(control).toHaveAttribute("data-side", "right");
  expect(control).toHaveStyle({ top: "192px" });
});

it("restores the minimized bubble position on the same mobile device", async () => {
  Object.defineProperty(window, "innerWidth", { value: 390, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: 844, configurable: true });
  const browser = userEvent.setup();
  const firstRender = render(<WorkSessionControl initialSession={null} />);
  await browser.click(
    screen.getByRole("button", { name: "Minimizar control de jornada" }),
  );
  const bubble = screen.getByRole("button", { name: "Abrir control de jornada" });
  fireEvent.pointerDown(bubble, { pointerId: 2, clientX: 360, clientY: 400 });
  fireEvent.pointerMove(bubble, { pointerId: 2, clientX: 20, clientY: 300 });
  fireEvent.pointerUp(bubble, { pointerId: 2, clientX: 20, clientY: 300 });
  firstRender.unmount();

  render(<WorkSessionControl initialSession={null} />);

  expect(
    await screen.findByRole("button", { name: "Abrir control de jornada" }),
  ).toBeVisible();
  const restored = screen.getByRole("complementary", {
    name: "Control de jornada",
  });
  expect(restored).toHaveAttribute("data-side", "left");
  expect(restored).toHaveStyle({ top: "272px" });
});

it("keeps the minimized bubble visible when the mobile viewport height changes", async () => {
  Object.defineProperty(window, "innerWidth", { value: 390, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: 844, configurable: true });
  const browser = userEvent.setup();
  render(<WorkSessionControl initialSession={null} />);
  await browser.click(
    screen.getByRole("button", { name: "Minimizar control de jornada" }),
  );

  const bubble = screen.getByRole("button", { name: "Abrir control de jornada" });
  fireEvent.pointerDown(bubble, { pointerId: 3, clientX: 360, clientY: 400 });
  fireEvent.pointerMove(bubble, { pointerId: 3, clientX: 360, clientY: 700 });
  fireEvent.pointerUp(bubble, { pointerId: 3, clientX: 360, clientY: 700 });
  expect(
    screen.getByRole("complementary", { name: "Control de jornada" }),
  ).toHaveStyle({ top: "672px" });

  Object.defineProperty(window, "innerHeight", { value: 390, configurable: true });
  fireEvent(window, new Event("resize"));

  await waitFor(() =>
    expect(
      screen.getByRole("complementary", { name: "Control de jornada" }),
    ).toHaveStyle({ top: "238px" }),
  );
});

it("reserves the mobile sale-action strip above the fixed clock", () => {
  render(<WorkSessionControl initialSession={null} />);

  expect(screen.getByRole("complementary", { name: "Control de jornada" })).toHaveClass(
    "bottom-20",
    "xl:bottom-6",
  );
});

it("starts an employee session and changes the persistent action to clock-out", async () => {
  const start = vi.fn().mockResolvedValue(openSession);
  const browser = userEvent.setup();

  render(
    <>
      <WorkSessionControl
        initialSession={null}
        workSessionClient={{ start, end: vi.fn() }}
      />
      <DashboardToaster />
    </>,
  );

  await browser.click(screen.getByRole("button", { name: "Marcar entrada" }));

  expect(start).toHaveBeenCalledOnce();
  expect(screen.getByText("Jornada en curso")).toBeVisible();
  expect(screen.getByRole("button", { name: "Marcar salida" })).toBeVisible();
  expect(await screen.findByText("Entrada registrada correctamente.")).toBeVisible();
  expect(refresh).toHaveBeenCalledOnce();
});

it("advances live elapsed time each minute and persists clock-out", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-21T11:35:00.000Z"));
  const closedSession: EmployeeWorkSession = {
    ...openSession,
    endedAt: "2026-08-21T11:35:00.000Z",
    state: "closed",
  };
  const end = vi.fn().mockResolvedValue(closedSession);
  render(
    <WorkSessionControl
      initialSession={openSession}
      workSessionClient={{ start: vi.fn(), end }}
    />,
  );

  expect(screen.getByText("1 h 35 min")).toBeVisible();
  act(() => vi.advanceTimersByTime(60_000));
  expect(screen.getByText("1 h 36 min")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Marcar salida" }));
  await act(async () => Promise.resolve());

  expect(end).toHaveBeenCalledOnce();
  expect(screen.getByText("Sin jornada abierta")).toBeVisible();
  expect(screen.getByRole("button", { name: "Marcar entrada" })).toBeVisible();
  expect(refresh).toHaveBeenCalledOnce();
});

it("synchronizes a changed server prop without discarding local mutations", async () => {
  const start = vi.fn().mockResolvedValue(openSession);
  const browser = userEvent.setup();
  const { rerender } = render(
    <WorkSessionControl
      initialSession={null}
      workSessionClient={{ start, end: vi.fn() }}
    />,
  );

  await browser.click(screen.getByRole("button", { name: "Marcar entrada" }));
  expect(screen.getByRole("button", { name: "Marcar salida" })).toBeVisible();

  rerender(
    <WorkSessionControl
      initialSession={{ ...openSession, id: "70000000-0000-4000-8000-000000000099" }}
      workSessionClient={{ start, end: vi.fn() }}
    />,
  );
  expect(screen.getByRole("button", { name: "Marcar salida" })).toBeVisible();

  rerender(
    <WorkSessionControl
      initialSession={null}
      workSessionClient={{ start, end: vi.fn() }}
    />,
  );
  expect(screen.getByRole("button", { name: "Marcar entrada" })).toBeVisible();
});
