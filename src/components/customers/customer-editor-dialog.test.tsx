import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { CustomerEditorDialog } from "@/components/customers/customer-editor-dialog";

const professional = { id: "00000000-0000-4000-8000-000000000003", firstName: "Fer", lastName: "Pérez", isActive: true };

it("keeps optional email and draft state when async creation fails", async () => {
  const user = userEvent.setup(); const onSave = vi.fn().mockRejectedValue(new Error("Ya existe un cliente con ese teléfono."));
  render(<CustomerEditorDialog mode="create" customer={null} customers={[]} currentUserRole="owner" onClose={vi.fn()} onSave={onSave} />);
  await user.type(screen.getByLabelText("Nombre"), "Ana"); await user.type(screen.getByLabelText("Apellido"), "Pérez"); await user.type(screen.getByLabelText("Teléfono"), "3515550101");
  await user.click(screen.getByRole("button", { name: "Crear cliente" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Ya existe un cliente con ese teléfono.");
  expect(onSave).toHaveBeenCalledWith({ firstName: "Ana", lastName: "Pérez", phone: "3515550101", email: null, fixedSchedule: null });
  expect(screen.getByLabelText("Nombre")).toHaveValue("Ana");
});

it("does not submit a parent sale form when saving the customer dialog", async () => {
  const user = userEvent.setup();
  const parentSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault());
  const onSave = vi.fn().mockResolvedValue({});
  render(
    <form onSubmit={parentSubmit}>
      <CustomerEditorDialog
        mode="create"
        customer={null}
        customers={[]}
        currentUserRole="owner"
        onClose={vi.fn()}
        onSave={onSave}
      />
    </form>,
  );

  await user.type(screen.getByLabelText("Nombre"), "Ana");
  await user.type(screen.getByLabelText("Apellido"), "Pérez");
  await user.type(screen.getByLabelText("Teléfono"), "3515550101");
  await user.click(screen.getByRole("button", { name: "Crear cliente" }));

  expect(onSave).toHaveBeenCalledOnce();
  expect(parentSubmit).not.toHaveBeenCalled();
});

it("adds one required weekly schedule and shows its readable preview", async () => {
  const user = userEvent.setup();
  const onSave = vi.fn().mockResolvedValue({});
  render(<CustomerEditorDialog mode="create" customer={null} customers={[]} currentUserRole="owner" onClose={vi.fn()} onSave={onSave} />);
  expect(screen.queryByLabelText("Día fijo")).not.toBeInTheDocument();
  await user.click(screen.getByRole("checkbox", { name: /es cliente habitual/i }));
  await user.selectOptions(screen.getByLabelText("Día fijo"), "4");
  await user.type(screen.getByLabelText("Hora fija"), "10:00");
  await user.type(screen.getByLabelText("Precio mensual"), "15000");
  expect(screen.getByText("Todos los jueves a las 10:00")).toBeVisible();
  await user.type(screen.getByLabelText("Nombre"), "Juan");
  await user.type(screen.getByLabelText("Apellido"), "Cruz");
  await user.type(screen.getByLabelText("Teléfono"), "3515550200");
  await user.click(screen.getByRole("button", { name: "Crear cliente" }));
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ fixedSchedule: { weekday: 4, time: "10:00", monthlyPrice: 15000 } }));
});

it("requires a valid time when a fixed schedule is enabled", async () => {
  const user = userEvent.setup();
  const onSave = vi.fn();
  render(<CustomerEditorDialog mode="create" customer={null} customers={[]} currentUserRole="owner" onClose={vi.fn()} onSave={onSave} />);
  await user.click(screen.getByRole("checkbox", { name: /es cliente habitual/i }));
  await user.type(screen.getByLabelText("Nombre"), "Juan");
  await user.type(screen.getByLabelText("Apellido"), "Cruz");
  await user.type(screen.getByLabelText("Teléfono"), "3515550200");
  await user.click(screen.getByRole("button", { name: "Crear cliente" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Ingresá una hora válida.");
  expect(onSave).not.toHaveBeenCalled();
});

it("loads and can disable an existing fixed schedule", async () => {
  const user = userEvent.setup();
  const onSave = vi.fn().mockResolvedValue({});
  const customer = {
    id: "10000000-0000-4000-8000-000000000001",
    firstName: "Juan",
    lastName: "Cruz",
    email: null,
    phone: "3515550200",
    visits: 4,
    createdAt: "2026-08-01T10:00:00.000Z",
    fixedSchedule: { weekday: 4 as const, time: "10:00", responsibleProfessional: professional, monthlyPrice: 15000 },
    fixedScheduleVersion: 1,
  };
  render(<CustomerEditorDialog mode="edit" customer={customer} customers={[customer]} currentUserRole="owner" availableProfessionals={[professional]} onClose={vi.fn()} onSave={onSave} />);
  expect(screen.getByRole("checkbox", { name: /es cliente habitual/i })).toBeChecked();
  expect(screen.getByText("Todos los jueves a las 10:00")).toBeVisible();
  await user.click(screen.getByRole("checkbox", { name: /es cliente habitual/i }));
  expect(screen.queryByLabelText("Día fijo")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ fixedSchedule: null }));
});

it("hides the professional selector for employees and shows the manager dropdown when a fixed schedule is enabled", () => {
  const customerWithSchedule = {
    id: "10000000-0000-4000-8000-000000000001",
    firstName: "J",
    lastName: "C",
    email: null,
    phone: "1",
    visits: 0,
    createdAt: "2026-08-01T10:00:00.000Z",
    fixedSchedule: { weekday: 4 as const, time: "10:00", responsibleProfessional: professional, monthlyPrice: 15000 },
    fixedScheduleVersion: 1,
  };
  const { rerender } = render(<CustomerEditorDialog mode="edit" customer={customerWithSchedule} customers={[customerWithSchedule]} currentUserRole="employee" onClose={vi.fn()} onSave={vi.fn()} />);
  expect(screen.queryByLabelText("Profesional responsable")).not.toBeInTheDocument();
  rerender(<CustomerEditorDialog mode="edit" customer={customerWithSchedule} customers={[customerWithSchedule]} currentUserRole="owner" availableProfessionals={[professional]} onClose={vi.fn()} onSave={vi.fn()} />);
  expect(screen.getByLabelText("Profesional responsable")).toBeInTheDocument();
});
