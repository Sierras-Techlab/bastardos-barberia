import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { DashboardToaster } from "@/components/ui/dashboard-toaster";
import type { ManagerWorkSession } from "@/types/work-session";
import { WorkSessionCorrectionDialog } from "./work-session-correction-dialog";

const session: ManagerWorkSession = {
  id: "70000000-0000-4000-8000-000000000001",
  employee: {
    id: "00000000-0000-4000-8000-000000000003",
    firstName: "Fernanda",
    lastName: "Pérez",
  },
  businessDate: "2026-08-21",
  startedAt: "2026-08-21T12:00:00.000Z",
  endedAt: "2026-08-21T20:00:47.321Z",
  state: "closed",
  metrics: {
    workedMinutes: 480,
    saleCount: 3,
    employeeCommission: 18000,
    grossTotal: 52000,
    barbershopNet: 34000,
  },
};

it("requires a reason before submitting a manager correction", async () => {
  const correct = vi.fn();
  const browser = userEvent.setup();

  render(
    <WorkSessionCorrectionDialog
      session={session}
      workSessionClient={{ correct }}
      onClose={vi.fn()}
      onSaved={vi.fn()}
    />,
  );

  await browser.click(screen.getByRole("button", { name: "Guardar corrección" }));

  expect(screen.getByRole("alert")).toHaveTextContent(
    "Indicá el motivo de la corrección.",
  );
  expect(correct).not.toHaveBeenCalled();
});
it("preserves seconds on the untouched endpoint while correcting the other", async () => {
  const corrected = {
    ...session,
    startedAt: "2026-08-21T13:00:00.000Z",
  };
  const correct = vi.fn().mockResolvedValue(corrected);
  const onSaved = vi.fn();
  const browser = userEvent.setup();

  render(
    <WorkSessionCorrectionDialog
      session={session}
      workSessionClient={{ correct }}
      onClose={vi.fn()}
      onSaved={onSaved}
    />,
  );

  fireEvent.change(screen.getByLabelText("Entrada corregida"), {
    target: { value: "2026-08-21T10:00" },
  });
  await browser.type(
    screen.getByLabelText("Motivo de la corrección"),
    "Olvido informado por el empleado",
  );
  await browser.click(screen.getByRole("button", { name: "Guardar corrección" }));

  expect(correct).toHaveBeenCalledWith(session.id, {
    startedAt: "2026-08-21T13:00:00.000Z",
    endedAt: "2026-08-21T20:00:47.321Z",
    reason: "Olvido informado por el empleado",
  });
  expect(onSaved).toHaveBeenCalledWith(corrected);
});

it("keeps a persisted correction successful when history refresh fails", async () => {
  const correct = vi.fn().mockResolvedValue(session);
  const onSaved = vi.fn().mockRejectedValue(new Error("refresh failed"));
  const onClose = vi.fn();
  const browser = userEvent.setup();

  render(
    <>
      <WorkSessionCorrectionDialog
        session={session}
        workSessionClient={{ correct }}
        onClose={onClose}
        onSaved={onSaved}
      />
      <DashboardToaster />
    </>,
  );

  await browser.type(
    screen.getByLabelText("Motivo de la corrección"),
    "Corrección confirmada",
  );
  await browser.click(screen.getByRole("button", { name: "Guardar corrección" }));

  await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  expect(correct).toHaveBeenCalledOnce();
  expect(
    (await screen.findAllByText("Jornada corregida correctamente.")).length,
  ).toBeGreaterThan(0);
  expect(
    await screen.findByText(
      "La jornada se guardó, pero no se pudo actualizar el historial.",
    ),
  ).toBeVisible();
  expect(within(screen.getByRole("dialog")).queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.queryByText("No se pudo corregir la jornada.")).not.toBeInTheDocument();
});
