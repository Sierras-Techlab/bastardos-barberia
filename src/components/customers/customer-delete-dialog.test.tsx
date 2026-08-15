import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { CustomerDeleteDialog } from "@/components/customers/customer-delete-dialog";

it("deletes only after explicit confirmation", async () => {
  const user = userEvent.setup(); const onConfirm = vi.fn().mockResolvedValue(undefined);
  render(<CustomerDeleteDialog customer={{ id: "id", firstName: "Ana", lastName: "Pérez", phone: "3515550101", email: null, visits: 0, createdAt: "2026-08-11T00:00:00.000Z", fixedSchedule: null, fixedScheduleVersion: null }} onClose={vi.fn()} onConfirm={onConfirm} />);
  await user.click(screen.getByRole("button", { name: "Eliminar cliente" }));
  expect(onConfirm).toHaveBeenCalledOnce();
});
