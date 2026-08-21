import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

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
  endedAt: "2026-08-21T20:00:00.000Z",
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
it("persists corrected timestamps and the audit reason", async () => {
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
    endedAt: "2026-08-21T20:00:00.000Z",
    reason: "Olvido informado por el empleado",
  });
  expect(onSaved).toHaveBeenCalledWith(corrected);
});
