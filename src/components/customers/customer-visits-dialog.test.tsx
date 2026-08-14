import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import type { Customer } from "@/types/customer";
import { CustomerVisitsDialog } from "./customer-visits-dialog";

const customer: Customer = {
  id: "10000000-0000-4000-8000-000000000001",
  firstName: "Ana",
  lastName: "Pérez",
  email: null,
  phone: "3515550101",
  visits: 2,
  createdAt: "2026-08-01T00:00:00.000Z",
  fixedSchedule: null,
  fixedScheduleVersion: null,
};

it("loads historical item prices, subtotals and the visit total without internal details", async () => {
  const listVisits = vi.fn().mockResolvedValue({
    items: [{
      id: "20000000-0000-4000-8000-000000000001",
      occurredAt: "2026-08-13T14:00:00.000Z",
      businessDate: "2026-08-13",
      totalSpent: 49000,
      items: [
        { type: "service", name: "Corte clásico", quantity: 1, unitPrice: 19000, subtotal: 19000 },
        { type: "product", name: "Cera mate", quantity: 2, unitPrice: 15000, subtotal: 30000 },
      ],
    }],
    pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
  });
  render(<CustomerVisitsDialog customer={customer} onClose={vi.fn()} client={{ listVisits }} />);
  expect(await screen.findByText("1 × Corte clásico")).toBeVisible();
  expect(screen.getByText("2 × Cera mate")).toBeVisible();
  expect(screen.getAllByText(/\$\s?19\.000/)).not.toHaveLength(0);
  expect(screen.getAllByText(/\$\s?30\.000/)).not.toHaveLength(0);
  expect(screen.getByText(/Total de la visita\s*\$\s?49\.000/)).toBeVisible();
  expect(screen.queryByText(/empleado|comisión/i)).not.toBeInTheDocument();
  expect(listVisits).toHaveBeenCalledWith(customer.id, { page: 1, pageSize: 20 }, expect.any(AbortSignal));
});

it("allows retry after an API error", async () => {
  const user = userEvent.setup();
  const listVisits = vi.fn()
    .mockRejectedValueOnce(new Error("No se pudo cargar."))
    .mockResolvedValueOnce({ items: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } });
  render(<CustomerVisitsDialog customer={customer} onClose={vi.fn()} client={{ listVisits }} />);
  await user.click(await screen.findByRole("button", { name: "Reintentar" }));
  expect(await screen.findByText("No hay visitas registradas.")).toBeVisible();
});
