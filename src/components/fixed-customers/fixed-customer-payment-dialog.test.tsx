import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FixedCustomerPaymentDialog } from "@/components/fixed-customers/fixed-customer-payment-dialog";
import type { FixedCustomerMonth } from "@/types/fixed-customer-payment";
import type { PaymentMethod } from "@/types/payment-method";

const managerMonth: FixedCustomerMonth = {
  viewer: "manager",
  customer: { id: "10000000-0000-4000-8000-000000000001", firstName: "Juan", lastName: "Cruz" },
  responsibleProfessional: { id: "00000000-0000-4000-8000-000000000003", firstName: "Fer", lastName: "Pérez" },
  period: "2026-08",
  status: "pending",
  paidAt: null,
  incomeId: null,
  employeeEarning: 4500,
  monthlyPrice: 15000,
};

const employeeMonth: FixedCustomerMonth = {
  ...managerMonth,
  viewer: "employee",
};

const paymentMethods: PaymentMethod[] = [
  { id: "00000000-0000-4000-8000-0000000000a1", name: "Efectivo", isActive: true },
  { id: "00000000-0000-4000-8000-0000000000a2", name: "Transferencia", isActive: true },
];

describe("FixedCustomerPaymentDialog", () => {
  beforeEach(() => {
    if (!globalThis.crypto) globalThis.crypto = {} as Crypto;
    globalThis.crypto.randomUUID = (() => "00000000-0000-4000-8000-0000000000aa") as typeof crypto.randomUUID;
  });

  it("submits a manager payment with the full monthly price and the selected method", async () => {
    const user = userEvent.setup();
    const pay = vi.fn().mockResolvedValue({ ...managerMonth, status: "paid", incomeId: "income-1" });
    render(
      <FixedCustomerPaymentDialog
        month={managerMonth}
        currentUserId="00000000-0000-4000-8000-000000000001"
        currentUserRole="owner"
        paymentMethods={paymentMethods}
        client={{ list: vi.fn(), get: vi.fn(), pay }}
        onClose={vi.fn()}
        onPaid={vi.fn()}
      />,
    );
    await user.type(screen.getByLabelText("Monto en Efectivo"), "150");
    await user.click(screen.getByRole("button", { name: /confirmar cobro/i }));
    await waitFor(() => expect(pay).toHaveBeenCalled());
    expect(pay).toHaveBeenCalledWith(expect.objectContaining({
      mode: "manager",
      customerId: managerMonth.customer.id,
      period: "2026-08",
      payments: [{ paymentMethodId: paymentMethods[0].id, amount: 15000 }],
    }));
  });

  it("submits employee basis points and never exposes monthlyPrice markup", () => {
    render(
      <FixedCustomerPaymentDialog
        month={employeeMonth}
        currentUserId="00000000-0000-4000-8000-000000000003"
        currentUserRole="employee"
        paymentMethods={paymentMethods}
        client={{ list: vi.fn(), get: vi.fn(), pay: vi.fn() }}
        onClose={vi.fn()}
        onPaid={vi.fn()}
      />,
    );
    expect(screen.queryByText("$ 15.000")).not.toBeInTheDocument();
    expect(screen.getByText("$ 4.500")).toBeInTheDocument();
  });

  it("disables submission for an already-paid month", () => {
    const pay = vi.fn();
    render(
      <FixedCustomerPaymentDialog
        month={{ ...managerMonth, status: "paid" }}
        currentUserId="00000000-0000-4000-8000-000000000001"
        currentUserRole="owner"
        paymentMethods={paymentMethods}
        client={{ list: vi.fn(), get: vi.fn(), pay }}
        onClose={vi.fn()}
        onPaid={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /ya cobrada/i })).toBeDisabled();
  });
});