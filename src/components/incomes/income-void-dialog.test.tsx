import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { IncomeVoidDialog } from "@/components/incomes/income-void-dialog";
import type { IncomeListItem } from "@/types/income";
const income = { id: "id", createdAt: "2026-08-11T12:00:00.000Z", businessDate: "2026-08-11", employee: { id: "u", firstName: "Ana", lastName: "Pérez" }, customer: null, service: null, products: [{ id: "p", name: "Gel", unitPrice: 1000, quantity: 1 }], paymentMethod: "cash", total: 1000, status: "active" } as IncomeListItem;
it("guards the irreversible-looking void behind confirmation", async () => { const user = userEvent.setup(); const confirm = vi.fn().mockResolvedValue(undefined); render(<IncomeVoidDialog income={income} onClose={vi.fn()} onConfirm={confirm} />); await user.click(screen.getByRole("button", { name: "Anular venta" })); expect(confirm).toHaveBeenCalledOnce(); });
